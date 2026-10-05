import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { ProjectStore, StoryboardProject, renderPanelPNG } from "../src/index.js";

it("reopening and saving unchanged artwork creates no new payloads or panel roots", async () => {
  const directory = await mkdtemp(join(tmpdir(), "board-canonical-"));
  try {
    const file = join(directory, "work.cboard"),
      p = StoryboardProject.create({ title: "Canonical" });
    const panel = p.addScene("s").addShot("s").addPanel();
    panel.addVectorLayer("ink").vectorStroke(
      [
        { y: 12, x: 9, pressure: 0.5 },
        { x: 80, y: 42 },
      ],
      { color: "#112233", width: 9 },
    );
    await p.save(file);
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const snapshot = () => ({
        roots: db.prepare("SELECT * FROM roots ORDER BY key").all(),
        panels: db.prepare("SELECT id,hash FROM panels ORDER BY id").all(),
        count: db.prepare("SELECT count(*) AS n FROM payloads").get(),
      });
      const before = snapshot();
      const reopened = await StoryboardProject.open(file);
      await reopened.save(file);
      expect(snapshot()).toEqual(before);
    } finally {
      db.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("named revisions share immutable payloads, survive compaction, and restore artwork, timing and media", async () => {
  const directory = await mkdtemp(join(tmpdir(), "board-revisions-"));
  try {
    const file = join(directory, "work.cboard"),
      board = StoryboardProject.create({ title: "Version test", width: 96, height: 54 });
    const panel = board.addScene("s").addShot("s").addPanel({ id: "p", durationFrames: 24 });
    const layer = panel.addVectorLayer("Drawing"),
      stroke = layer.vectorStroke(
        [
          { x: 4, y: 8 },
          { x: 80, y: 40 },
        ],
        { width: 6 },
      );
    const bytes = Buffer.from(Array.from({ length: 100000 }, (_, i) => i % 251));
    await writeFile(join(directory, "sound.wav"), bytes);
    board.production.addAsset({
      id: "sound",
      name: "sound",
      kind: "audio",
      path: "sound.wav",
      mimeType: "audio/wav",
      source: "managed",
    });
    await board.save(file);
    const original = board.toJSON(),
      image = await renderPanelPNG(board, "p");
    const store = ProjectStore.open(file);
    try {
      const assets = () => store.inspect().payloads.find((r) => r.kind === "asset")!.count;
      store.saveRevision("approved", { expectedVersion: board.version });
      expect(assets()).toBe(1);
      expect(() => store.saveRevision("approved", { expectedVersion: board.version })).toThrow(
        /already exists/,
      );
      board.production.setPanelDuration("p", 48);
      layer.edit(stroke, (e) =>
        e.kind === "vector-stroke"
          ? { ...e, points: e.points.map((p) => ({ ...p, y: p.y + 9 })) }
          : e,
      );
      const changed = Buffer.from("replacement audio"),
        checksum = createHash("sha256").update(changed).digest("hex");
      await writeFile(join(directory, "sound.wav"), changed);
      board.production.updateAsset("sound", { checksum });
      await board.save(file);
      store.saveRevision("longer", { expectedVersion: board.version });
      expect(assets()).toBe(2);
      expect(store.readAsset("sound")).toEqual(changed);
      expect((await renderPanelPNG(store.readDocument(), "p")).equals(image)).toBe(false);
      expect(store.readAsset("sound", { revision: "approved" })).toEqual(bytes);
      expect(store.readPanel("p", { revision: "approved" })).toEqual(original.panels[0]);
      expect(
        (await renderPanelPNG(store.panelDocument("p", { revision: "approved" }), "p")).equals(
          image,
        ),
      ).toBe(true);
      store.compact();
      expect(store.readRevision("approved")).toEqual(original);
      expect((await renderPanelPNG(store.readRevision("approved"), "p")).equals(image)).toBe(true);
      const current = store.version;
      store.restoreRevision("approved", { expectedVersion: current });
      expect(store.version).toBe(current + 1);
      expect(store.readPanel("p").durationFrames).toBe(24);
      expect(store.readAsset("sound")).toEqual(bytes);
      expect((await renderPanelPNG(store.readDocument(), "p")).equals(image)).toBe(true);
      expect(store.readRevision("longer").panels[0]!.durationFrames).toBe(48);
      store.deleteRevision("longer");
      store.compact();
      store.verify();
      expect(assets()).toBe(1);
      expect(store.listRevisions().map((r) => r.name)).toEqual(["approved"]);
    } finally {
      store.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("saves stable drawing IDs transferred between panels in one transaction", async () => {
  const directory = await mkdtemp(join(tmpdir(), "board-ownership-"));
  try {
    const file = join(directory, "work.cboard"),
      p = StoryboardProject.create({ title: "Ownership" });
    const shot = p.addScene("s").addShot("s"),
      a = shot.addPanel({ id: "a" }),
      b = shot.addPanel({ id: "b" });
    a.addVectorLayer("A", { id: "layer:a" });
    b.addVectorLayer("B", { id: "layer:b" });
    await p.save(file);
    const doc = p.toJSON();
    [doc.panels[0]!.layers, doc.panels[1]!.layers] = [doc.panels[1]!.layers, doc.panels[0]!.layers];
    const revised = StoryboardProject.fromJSON(doc);
    revised.setMetadata("move", "swap layer ownership");
    await revised.save(file, { expectedVersion: p.version });
    const store = ProjectStore.open(file);
    try {
      expect(store.findObjects({ panelId: "a", kind: "vector" })[0]!.id).toBe("layer:b");
      store.verify();
    } finally {
      store.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
