import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { spawnSync } from "node:child_process";
import { StoryboardProject, ProjectStore, renderPanelPNG, brushes } from "../src/index.js";

it("invalidates old sessions when an overwrite reuses or lowers the authoring version", async () => {
  const directory = await mkdtemp(join(tmpdir(), "board-overwrite-"));
  try {
    const file = join(directory, "project.cboard"),
      first = StoryboardProject.create({ title: "First" });
    first.addScene("S").addShot("S").addPanel();
    await first.save(file);
    const stale = await StoryboardProject.open(file),
      before = stale.version;
    const replacement = StoryboardProject.create({ title: "Replacement" });
    replacement.addScene("S").addShot("S").addPanel();
    expect(replacement.version).toBe(before);
    await replacement.save(file, { overwrite: true });
    expect(replacement.version).toBeGreaterThan(before);
    expect((await StoryboardProject.open(file)).version).toBe(replacement.version);
    stale.setMetadata("stale", "yes");
    await expect(stale.save(file)).rejects.toThrow(/Disk version conflict/);
    replacement.setMetadata("continued", "yes");
    await replacement.save(file);
    const old = StoryboardProject.create({ title: "Older source" });
    await old.save(file, { overwrite: true });
    expect(old.version).toBeGreaterThan(replacement.version);
    expect((await StoryboardProject.open(file)).title).toBe("Older source");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("advances the stored version for changed low-level saves but not unchanged saves", async () => {
  const directory = await mkdtemp(join(tmpdir(), "board-version-"));
  try {
    const file = join(directory, "project.cboard"),
      p = StoryboardProject.create({ title: "Store version" });
    p.addScene("S").addShot("S").addPanel();
    await p.save(file);
    const store = ProjectStore.open(file);
    try {
      const document = store.readDocument(),
        version = store.version;
      store.save(document, { expectedVersion: version });
      expect(store.version).toBe(version);
      document.panels[0]!.notes = "Edited through store";
      store.save(document, { expectedVersion: version });
      expect(store.version).toBeGreaterThan(version);
      expect(document.version).toBe(version);
      expect(() => store.save(document, { expectedVersion: version })).toThrow(
        /Disk version conflict/,
      );
    } finally {
      store.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("commits atomically, rejects stale writers, and updates one panel without touching another", async () => {
  const directory = await mkdtemp(join(tmpdir(), "board-save-"));
  try {
    const path = join(directory, "project.cboard"),
      p = StoryboardProject.create({ title: "Disk conflict", width: 96, height: 54 });
    const shot = p.addScene("s").addShot("s");
    for (const id of ["a", "b"])
      shot
        .addPanel({ id })
        .addRasterLayer("paint")
        .rasterStroke(
          [
            { x: 2, y: 4, pressure: 0.13333333333333333 },
            { x: 80, y: 40, time: 0.2 },
          ],
          {
            ...brushes.cleanInk,
            tip: {
              kind: "bitmap",
              width: 2,
              height: 2,
              alpha: [0, 0.37123456789123, 1, 0],
              angle: 0,
              rotationMode: "stroke",
            },
          },
        );
    await p.save(path);
    expect((await readFile(path)).subarray(0, 16).toString()).toBe("SQLite format 3\0");
    const a = await StoryboardProject.open(path),
      b = await StoryboardProject.open(path);
    a.setMetadata("note", "first writer");
    await a.save(path);
    b.setMetadata("note", "stale writer");
    await expect(b.save(path)).rejects.toThrow(/Disk version conflict/);
    expect((await StoryboardProject.open(path)).toJSON().metadata.note).toBe("first writer");
    const crash = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import {DatabaseSync} from 'node:sqlite';const db=new DatabaseSync(process.argv[1]);db.exec("BEGIN IMMEDIATE; UPDATE panels SET info='broken'");process.exit(9);`,
        path,
      ],
      { windowsHide: true },
    );
    expect(crash.status).toBe(9);
    expect((await StoryboardProject.open(path)).toJSON().panels).toEqual(a.toJSON().panels);
    expect(a.toJSON().panels).toEqual(p.toJSON().panels);
    const store = ProjectStore.open(path);
    try {
      const version = store.version,
        other = store.readPanel("b"),
        before = await renderPanelPNG(store.panelDocument("a"), "a");
      const panel = store.readPanel("a");
      panel.layers[0]!.transform.x = 10;
      store.updatePanel(panel, { expectedVersion: version });
      expect(store.readPanel("b")).toEqual(other);
      expect((await renderPanelPNG(store.panelDocument("a"), "a")).equals(before)).toBe(false);
      expect(() => store.updatePanel(panel, { expectedVersion: version })).toThrow(
        /version conflict/,
      );
      const doc = store.readDocument();
      doc.assets.push({
        id: "missing",
        kind: "audio",
        source: "managed",
        mimeType: "audio/wav",
        name: "missing",
        path: "missing.wav",
      });
      expect(() => store.save(doc, { expectedVersion: store.version })).toThrow(/Missing asset/);
      expect(store.readHeader().assets).toEqual([]);
      const prior = store.readDocument();
      store.compact();
      store.verify();
      expect(store.readDocument()).toEqual(prior);
      expect(store.findObjects({ panelId: "a", limit: 2 })).toHaveLength(2);
    } finally {
      store.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("embeds assets once and detects corrupted payloads and unknown versions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "board-integrity-"));
  try {
    const path = join(directory, "project.cboard"),
      p = StoryboardProject.create({ title: "Assets" });
    const bytes = Buffer.from("same lossless source bytes");
    await writeFile(join(directory, "sound.wav"), bytes);
    for (const id of ["one", "two"])
      p.production.addAsset({
        id,
        kind: "audio",
        name: id,
        path: "sound.wav",
        mimeType: "audio/wav",
        source: "managed",
      });
    await p.save(path);
    await writeFile(join(directory, "sound.wav"), Buffer.from("external file changed"));
    p.setMetadata("note", "unrelated revision");
    await p.save(path);
    const copy = join(directory, "copy", "copied.cboard");
    await p.save(copy);
    expect((await StoryboardProject.open(copy)).readAsset("one")).toEqual(bytes);
    const s = ProjectStore.open(path);
    expect(s.readAsset("one")).toEqual(bytes);
    expect(s.inspect().payloads.find((p) => p.kind === "asset")!.count).toBe(1);
    s.close();
    const db = new DatabaseSync(path);
    db.prepare("UPDATE payloads SET data=? WHERE kind='asset'").run(Buffer.from("broken"));
    db.close();
    const corrupt = ProjectStore.open(path);
    expect(() => corrupt.readAsset("one")).toThrow(/Corrupt payload/);
    corrupt.close();
    const changed = new DatabaseSync(path);
    changed.exec("PRAGMA user_version=999");
    changed.close();
    expect(() => ProjectStore.open(path)).toThrow(/Unsupported project container/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
