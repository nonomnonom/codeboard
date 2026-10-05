import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  StoryboardProject,
  ProjectStore,
  createPixels,
  decodePixels,
  encodePixels,
  renderPanelPNG,
  createRenderSession,
  brushes,
} from "../src/index.js";
import { difference, applyRevision } from "../src/core/history.js";

it("owns raw document pixels and layer state in a validated render session", async () => {
  const project = StoryboardProject.create({
    title: "Snapshot",
    width: 64,
    height: 64,
    background: "#ffffff",
  });
  const panel = project.addScene("s").addShot("s").addPanel({ id: "p" });
  const image = createPixels(16, 16);
  for (let i = 0; i < image.pixels.length; i += 4) image.pixels.set([180, 30, 50, 255], i);
  panel.addRasterLayer("Paint").rasterSurface(image);
  const raw = project.toJSON(),
    session = createRenderSession(raw);
  const before = await session.panel("p").toBuffer("png");
  const layer = raw.panels[0]!.layers[0]!;
  if (layer.kind === "group") throw new Error("Expected raster layer");
  const surface = layer.elements[0]!;
  if (surface.kind !== "raster-surface") throw new Error("Expected pixel surface");
  surface.pixels.fill(0);
  layer.transform.x = 24;
  expect((await session.panel("p").toBuffer("png")).equals(before)).toBe(true);
  expect((await createRenderSession(raw).panel("p").toBuffer("png")).equals(before)).toBe(false);
  raw.panels[0]!.shotId = "missing-shot";
  expect(() => createRenderSession(raw)).toThrow();
  expect(() => StoryboardProject.fromJSON(raw)).toThrow();
});

it("keeps pixel regions editable through undo, storage revisions, transforms and ordered erasing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "board-pixels-"));
  try {
    const p = StoryboardProject.create({
      title: "Pixels",
      width: 64,
      height: 64,
      background: "#ffffff",
    });
    const panel = p.addScene("s").addShot("s").addPanel({ id: "p" });
    const layer = panel.addRasterLayer("Pixel paint");
    const image = createPixels(32, 32);
    for (let i = 0; i < image.pixels.length; i += 4) image.pixels.set([180, 30, 50, 255], i);
    const id = layer.rasterSurface(image, { matrix: [1, 0, 0, 1, 8, 8] });
    image.pixels.fill(0);
    const original = layer.readPixels(id);
    expect(original.pixels[0]).toBe(180);
    expect(await decodePixels(await encodePixels(original))).toEqual(original);
    const translucent = {
      width: 2,
      height: 1,
      pixels: new Uint8Array([13, 24, 35, 0, 25, 50, 75, 129]),
    };
    expect(await decodePixels(await encodePixels(translucent))).toEqual(translucent);
    const png = await renderPanelPNG(p, "p");
    const rendered = await decodePixels(png);
    expect([...rendered.pixels.slice((10 * 64 + 10) * 4, (10 * 64 + 10) * 4 + 4)]).toEqual([
      180, 30, 50, 255,
    ]);
    const file = join(directory, "pixels.cboard");
    await p.save(file);
    const store = ProjectStore.open(file);
    try {
      store.saveRevision("original", { expectedVersion: store.version });
      layer.editPixels(id, { x: 4, y: 5, width: 3, height: 2 }, (patch) => {
        for (let i = 0; i < patch.pixels.length; i += 4) patch.pixels.set([10, 180, 80, 255], i);
      });
      const edited = layer.readPixels(id);
      expect(edited.pixels[(5 * 32 + 4) * 4]).toBe(10);
      p.undo();
      expect(layer.readPixels(id)).toEqual(original);
      p.redo();
      expect(layer.readPixels(id)).toEqual(edited);
      expect(() => layer.editPixels(id, { x: 31, y: 0, width: 2, height: 2 }, () => {})).toThrow(
        /inside/,
      );
      expect(() =>
        layer.editPixels(id, { x: 0, y: 0, width: 1, height: 1 }, async () => {}),
      ).toThrow(/synchronous/);
      expect(layer.readPixels(id)).toEqual(edited);
      await p.save(file);
      store.compact();
      store.verify();
      expect(await renderPanelPNG(store.panelDocument("p", { revision: "original" }), "p")).toEqual(
        png,
      );
      const reopened = await StoryboardProject.open(file);
      expect(reopened.panel("p").layer(layer.id).readPixels(id)).toEqual(edited);
      expect(await renderPanelPNG(reopened, "p")).toEqual(await renderPanelPNG(p, "p"));
      layer.erase([{ x: 20, y: 20 }], {
        ...brushes.cleanInk,
        size: 12,
        opacity: 1,
        flow: 1,
        taperStart: 0,
        taperEnd: 0,
      });
      const erased = await decodePixels(await renderPanelPNG(p, "p"));
      expect([...erased.pixels.slice((20 * 64 + 20) * 4, (20 * 64 + 20) * 4 + 3)]).toEqual([
        255, 255, 255,
      ]);
      layer.set({ transform: { x: 8, y: 0, scaleX: 1, scaleY: 1, rotation: 0 } });
      const moved = await decodePixels(await renderPanelPNG(p, "p"));
      expect([...moved.pixels.slice((10 * 64 + 10) * 4, (10 * 64 + 10) * 4 + 3)]).toEqual([
        255, 255, 255,
      ]);
      p.select({ panelId: "p", layerId: layer.id, elementIds: [id] }).transform({
        rotation: Math.PI / 2,
        x: 48,
      });
      const matrix = p.production.layer(layer.id);
      expect(matrix.kind).toBe("raster");
      if (matrix.kind !== "group") {
        const element = matrix.elements.find((e) => e.id === id)!;
        [0, 1, -1, 0, 40, 8].forEach((v, i) => {
          expect(element.matrix![i]).toBeCloseTo(v);
        });
      }
      expect(await createRenderSession(p).panel("p").toBuffer("png")).toEqual(
        await renderPanelPNG(p, "p", { annotations: false }),
      );
    } finally {
      store.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("retains byte ranges in undo and rejects invalid pixel allocations", () => {
  const before = { pixels: new Uint8Array(1024 * 1024) },
    after = structuredClone(before);
  after.pixels[12] = 255;
  after.pixels[900000] = 37;
  const delta = difference(before, after);
  expect(delta).toHaveLength(2);
  expect(delta.reduce((n, e) => n + (e.after as Uint8Array).length, 0)).toBe(2);
  expect(
    Buffer.from(applyRevision(before, delta, "after").pixels).equals(Buffer.from(after.pixels)),
  ).toBe(true);
  expect(
    Buffer.from(applyRevision(after, delta, "before").pixels).equals(Buffer.from(before.pixels)),
  ).toBe(true);
  expect(() => createPixels(Infinity, 10)).toThrow(/dimensions/);
  expect(() => createPixels(100000, 100000)).toThrow(/budget/);
});
