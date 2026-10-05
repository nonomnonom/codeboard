import { expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { StoryboardProject, ProjectStore, createToneWav } from "../../../src/index.js";

it.each(["panel", "object", "missing-object", "component", "missing-asset", "asset-type"] as const)(
  "detects a damaged %s index even when SQLite and artwork hashes remain valid",
  async (kind) => {
    const directory = await mkdtemp(join(tmpdir(), "board-index-"));
    try {
      const file = join(directory, "test.cboard"),
        project = StoryboardProject.create({ title: "Indexes" });
      const panel = project
        .addScene("S")
        .addShot("S")
        .addPanel({ id: "panel:test", durationFrames: 12 });
      const layer = panel.addVectorLayer("Ink");
      layer.text("Editable", 1, 20);
      project.production.captureComponent(layer.id, "Reusable ink");
      await writeFile(join(directory, "cue.wav"), createToneWav({ durationSeconds: 0.01 }));
      project.production.addAsset({
        name: "Cue",
        kind: "audio",
        source: "managed",
        path: "cue.wav",
        mimeType: "audio/wav",
      });
      await project.save(file);
      const store = ProjectStore.open(file);
      try {
        store.verify();
        store.saveRevision("good", { expectedVersion: project.version });
        const db = new DatabaseSync(file);
        try {
          if (kind === "panel")
            db.prepare("UPDATE panels SET info=json_set(info,'$.startFrame',99) WHERE id=?").run(
              panel.id,
            );
          else if (kind === "object")
            db.prepare("UPDATE objects SET name='Wrong name' WHERE id=?").run(panel.id);
          else if (kind === "missing-object")
            db.prepare("DELETE FROM objects WHERE id=?").run(panel.id);
          else if (kind === "component")
            db.exec("UPDATE components SET info=json_set(info,'$.name','Wrong name')");
          else if (kind === "missing-asset") db.exec("DELETE FROM assets");
          else db.exec("UPDATE assets SET hash=(SELECT hash FROM panels LIMIT 1)");
          expect(db.prepare("PRAGMA integrity_check").get()!.integrity_check).toBe("ok");
        } finally {
          db.close();
        }
        expect(() => store.verify()).toThrow();
        if (kind === "panel") expect(() => store.readPanel(panel.id)).toThrow(/Panel index/);
        expect(store.readPanel(panel.id, { revision: "good" }).id).toBe(panel.id);
      } finally {
        store.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
