import { expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  StoryboardProject,
  brushes,
  customizeBrush,
  line,
  createRenderSession,
  renderFramePNG,
} from "../../../src/index.js";
import { RenderCache } from "../../../src/render/layer-compositor.js";

it("reveals deterministic dab prefixes, survives persistence and backward cached seeking", async () => {
  const board = StoryboardProject.create({
    title: "Write on",
    width: 200,
    height: 80,
    frameRate: 24,
  });
  const p = board.addScene("S").addShot("A").addPanel({ durationFrames: 24 });
  p.addRasterLayer("Ink").rasterStroke(
    line({ x: 15, y: 40 }, { x: 185, y: 40 }, 40),
    customizeBrush(brushes.charcoal, { size: 18 }),
    { seed: 42, reveal: { startFrame: 2, endFrame: 18 } },
  );
  const session = createRenderSession(board);
  const image = async (f: number) => await session.frame(f).toBuffer("png");
  const blank = await image(0),
    half = await image(10),
    full = await image(18);
  expect(blank.equals(half)).toBe(false);
  expect(half.equals(full)).toBe(false);
  expect((await image(23)).equals(full)).toBe(true);
  expect((await image(10)).equals(half)).toBe(true);
  const a = session.frame(10).getContext("2d").getImageData(0, 0, 70, 80).data;
  const b = session.frame(23).getContext("2d").getImageData(0, 0, 70, 80).data;
  expect(a).toEqual(b);
  const dir = await mkdtemp(join(tmpdir(), "reveal-"));
  try {
    await board.save(join(dir, "test.cboard"));
    const opened = await StoryboardProject.open(join(dir, "test.cboard"));
    expect((await renderFramePNG(opened, 10)).equals(half)).toBe(true);
    opened.production.setPanelDuration(p.id, 48);
    const layer = opened.toJSON().panels[0]!.layers[0]!;
    expect(
      layer.kind !== "group" &&
        layer.elements[0]!.kind === "raster-stroke" &&
        layer.elements[0]!.reveal,
    ).toEqual({ startFrame: 4, endFrame: 37 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it("rejects nonpositive reveal ranges and strips animation when capturing artwork", () => {
  const b = StoryboardProject.create({ title: "Reveal validation" });
  const p = b.addScene("S").addShot("A").addPanel();
  const l = p.addRasterLayer("Ink");
  expect(() =>
    l.rasterStroke([{ x: 10, y: 10 }], brushes.cleanInk, {
      reveal: { startFrame: 5, endFrame: 5 },
    }),
  ).toThrow();
  l.rasterStroke([{ x: 10, y: 10 }], brushes.cleanInk, { reveal: { startFrame: 1, endFrame: 5 } });
  b.production.captureComponent(l.id, "Static art");
  const layer = b.toJSON().components[0]!.layers[0]!;
  expect(
    layer.kind !== "group" &&
      layer.elements[0]!.kind === "raster-stroke" &&
      layer.elements[0]!.reveal,
  ).toBeUndefined();
});

it("rerasterizes brush cache at display scale instead of magnifying coarse pixels", () => {
  const b = StoryboardProject.create({ title: "Scale", width: 300, height: 150 });
  const p = b.addScene("S").addShot("A").addPanel();
  p.addRasterLayer("Ink").rasterStroke(line({ x: 10, y: 10 }, { x: 60, y: 25 }), brushes.cleanInk);
  const panel = b.toJSON().panels[0]!,
    layer = panel.layers[0]!;
  if (layer.kind === "group") throw new Error("Expected drawing");
  const cache = new RenderCache();
  const native = cache.artwork(panel, layer, Infinity, 1),
    large = cache.artwork(panel, layer, Infinity, 3);
  expect(large.canvas.width).toBe(native.canvas.width * 3);
  expect(large.canvas.height).toBe(native.canvas.height * 3);
  expect(cache.artwork(panel, layer, Infinity, 3)).toBe(large);
  expect(cache.artwork(panel, layer, Infinity, 1).canvas.width).toBe(native.canvas.width);
});
