afterEach(() => jest.restoreAllMocks());

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ProjectStore, StoryboardProject, renderFramePNG, startPreview } from "../src/index.js";
import { PayloadCodec } from "../src/storage/codec.js";

it.each(["cut", "dissolve", "wipe-left", "wipe-right"] as const)(
  "partially decodes frame context with %s and preserves historical renders",
  async (type) => {
    const directory = await mkdtemp(join(tmpdir(), "frame-store-"));
    try {
      const file = join(directory, "test.cboard"),
        project = StoryboardProject.create({ title: "Partial frame", width: 32, height: 16 });
      const scene = project.addScene("S");
      for (const [index, color] of ["#ff0000", "#0000ff", "#00ff00"].entries()) {
        const shot = scene.addShot(`Shot ${index}`),
          panel = shot.addPanel({ id: `p${index}`, durationFrames: 4 });
        panel
          .addVectorLayer("Ink")
          .path(
            [
              { op: "M", x: 0, y: 0 },
              { op: "L", x: 32, y: 0 },
              { op: "L", x: 32, y: 16 },
              { op: "L", x: 0, y: 16 },
              { op: "Z" },
            ],
            { fill: color },
          );
        project.production.addCameraKeyframe(shot.id, index * 4, {
          x: 0,
          y: 0,
          rotation: 0,
          easing: "linear",
          zoom: 1,
        });
        project.production.addCameraKeyframe(shot.id, index * 4 + 3, {
          x: 5,
          y: 0,
          rotation: 0,
          easing: "linear",
          zoom: 1.1,
        });
      }
      project.production.setTransition("p0", { type, durationFrames: type === "cut" ? 0 : 2 });
      await project.save(file);
      const store = ProjectStore.open(file);
      try {
        store.saveRevision("before", { expectedVersion: project.version });
        const metadata = new DatabaseSync(file, { readOnly: true });
        let panelHashes: Map<string, string>;
        try {
          panelHashes = new Map(
            metadata
              .prepare("SELECT id,hash FROM panels")
              .all()
              .map((row) => [String(row.hash), String(row.id)]),
          );
        } finally {
          metadata.close();
        }
        const read = jest.spyOn(PayloadCodec.prototype, "get");
        for (let frame = 0; frame < 12; frame++) {
          read.mockClear();
          const partial = store.frameDocument(frame);
          const expected =
            frame >= 2 && frame < 4 && type !== "cut"
              ? ["p0", "p1"]
              : [`p${Math.floor(frame / 4)}`];
          expect(partial.panels.map((p) => p.id)).toEqual(expected);
          expect(
            read.mock.calls
              .map((call) => panelHashes.get(call[0]))
              .filter((id) => id !== undefined),
          ).toEqual(expected);
          expect(
            (await renderFramePNG(partial, frame)).equals(await renderFramePNG(project, frame)),
          ).toBe(true);
        }
        const old = await renderFramePNG(store.frameDocument(2), 2);
        project.production.setPanelDuration("p0", 6);
        await project.save(file);
        expect(
          (await renderFramePNG(store.frameDocument(2, { revision: "before" }), 2)).equals(old),
        ).toBe(true);
        for (const frame of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 14])
          expect(() => store.frameDocument(frame)).toThrow(/Render frame|No panel/);
        // An unrelated damaged artwork payload must not be decoded by frame review.
        const db = new DatabaseSync(file);
        try {
          db.prepare(
            "UPDATE payloads SET data=? WHERE hash=(SELECT hash FROM panels WHERE id='p2')",
          ).run(Buffer.from("damaged"));
        } finally {
          db.close();
        }
        expect(() => store.readDocument()).toThrow();
        const png = await renderFramePNG(store.frameDocument(2), 2);
        expect(png.length).toBeGreaterThan(0);
        const server = await startPreview(file, { port: 0 });
        try {
          const address = server.address();
          if (!address || typeof address === "string") throw new Error("Expected TCP address");
          const response = await fetch(`http://127.0.0.1:${address.port}/frame/2.png`);
          expect(response.status).toBe(200);
          expect(Buffer.from(await response.arrayBuffer()).equals(png)).toBe(true);
        } finally {
          await new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          );
        }
      } finally {
        store.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
