import { expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createPixels,
  fillPixels,
  colorPixelSelection,
  polygonPixelSelection,
  combinePixelSelections,
  invertPixelSelection,
  featherPixelSelection,
  StoryboardProject,
} from "../../../src/index.js";

it("flood selection stops at barriers, separates diagonals, and ignores hidden RGB", () => {
  const image = createPixels(5, 3);
  fillPixels(image, [40, 60, 80, 255]);
  for (let y = 0; y < 3; y++) image.pixels.set([0, 0, 0, 255], (y * 5 + 2) * 4);
  expect([...colorPixelSelection(image, 0, 0).coverage]).toEqual([
    255, 255, 0, 0, 0, 255, 255, 0, 0, 0, 255, 255, 0, 0, 0,
  ]);
  expect(
    [...colorPixelSelection(image, 0, 0, { contiguous: false }).coverage].filter((x) => x === 255),
  ).toHaveLength(12);
  const diagonal = createPixels(2, 2);
  fillPixels(diagonal, [255, 255, 255, 255]);
  diagonal.pixels.set([0, 0, 0, 255], 0);
  diagonal.pixels.set([0, 0, 0, 255], 12);
  expect([...colorPixelSelection(diagonal, 0, 0).coverage]).toEqual([255, 0, 0, 0]);
  const invisible = createPixels(2, 1);
  invisible.pixels[0] = 255;
  expect([...colorPixelSelection(invisible, 0, 0).coverage]).toEqual([255, 255]);
  image.pixels[4] = 45;
  expect(colorPixelSelection(image, 0, 0).coverage[1]).toBe(0);
  expect(colorPixelSelection(image, 0, 0, { tolerance: 5 }).coverage[1]).toBe(255);
});

it("polygon masks retain antialiased edges and compose without changing inputs", () => {
  const a = polygonPixelSelection(8, 8, [
    { x: 1.3, y: 1.2 },
    { x: 7, y: 2.1 },
    { x: 2, y: 7 },
  ]);
  expect(a.coverage.some((x) => x > 0 && x < 255)).toBe(true);
  expect(a.coverage[0]).toBe(0);
  expect(a.coverage[3 * 8 + 3]).toBe(255);
  const inverted = invertPixelSelection(a);
  expect([...combinePixelSelections(a, a, "subtract").coverage].every((x) => x === 0)).toBe(true);
  expect(combinePixelSelections(a, a, "intersect")).toEqual(a);
  expect(combinePixelSelections(a, a, "union")).toEqual(a);
  expect(invertPixelSelection(inverted)).toEqual(a);
});

it("fill respects coverage, partial alpha, alpha lock and erasure without destroying hidden RGB", () => {
  const image = createPixels(2, 1);
  image.pixels.set([0, 0, 255, 128, 12, 34, 56, 0]);
  fillPixels(image, [255, 0, 0, 128], {
    selection: { width: 2, height: 1, coverage: new Uint8Array([255, 0]) },
  });
  expect([...image.pixels]).toEqual([170, 0, 85, 192, 12, 34, 56, 0]);
  fillPixels(image, [20, 40, 60, 255], { mode: "source-atop" });
  expect([...image.pixels]).toEqual([20, 40, 60, 192, 12, 34, 56, 0]);
  fillPixels(image, [0, 0, 0, 255], {
    mode: "destination-out",
    selection: { width: 2, height: 1, coverage: new Uint8Array([128, 0]) },
  });
  expect([...image.pixels]).toEqual([20, 40, 60, 96, 12, 34, 56, 0]);
  fillPixels(image, [1, 2, 3, 0], { mode: "copy" });
  expect([...image.pixels]).toEqual([1, 2, 3, 0, 1, 2, 3, 0]);
  image.pixels.set([0, 0, 255, 128], 0);
  fillPixels(image, [255, 0, 0, 128], {
    mode: "copy",
    selection: { width: 2, height: 1, coverage: new Uint8Array([128, 0]) },
  });
  expect([...image.pixels.slice(0, 4)]).toEqual([128, 0, 127, 128]);
  fillPixels(image, [255, 255, 255, 255]);
  fillPixels(image, [0, 0, 0, 255], {
    selection: { width: 2, height: 1, coverage: image.pixels.subarray(0, 2) },
  });
  expect([...image.pixels]).toEqual([0, 0, 0, 255, 0, 0, 0, 255]);
});

it("selected fill participates in project rollback and undo", () => {
  const p = StoryboardProject.create({ title: "Fill" }),
    panel = p.addScene("s").addShot("s").addPanel(),
    layer = panel.addRasterLayer("paint");
  const image = createPixels(16, 16),
    id = layer.rasterSurface(image);
  layer.editPixels(id, { x: 0, y: 0, width: 16, height: 16 }, (patch) =>
    fillPixels(patch, [180, 90, 30, 255], {
      selection: polygonPixelSelection(16, 16, [
        { x: 1, y: 1 },
        { x: 15, y: 1 },
        { x: 8, y: 15 },
      ]),
    }),
  );
  const edited = layer.readPixels(id);
  expect(edited.pixels[4 * (4 * 16 + 8) + 3]).toBe(255);
  p.undo();
  expect(layer.readPixels(id)).toEqual(image);
  p.redo();
  expect(layer.readPixels(id)).toEqual(edited);
  expect(() =>
    layer.editPixels(id, { x: 0, y: 0, width: 16, height: 16 }, (patch) =>
      fillPixels(patch, [255, 0, 0, 255], {
        selection: { width: 1, height: 1, coverage: new Uint8Array(1) },
      }),
    ),
  ).toThrow(/matching dimensions/);
  expect(layer.readPixels(id)).toEqual(edited);
});

it("feathers coverage symmetrically without blurring source artwork or sharing inputs", async () => {
  const selection = polygonPixelSelection(25, 25, [
    { x: 8, y: 8 },
    { x: 17, y: 8 },
    { x: 17, y: 17 },
    { x: 8, y: 17 },
  ]);
  const original = selection.coverage.slice(),
    pending = featherPixelSelection(selection, 2);
  selection.coverage.fill(0);
  const soft = await pending;
  expect(soft.coverage).toHaveLength(625);
  expect(soft.coverage[12 * 25 + 6]).toBeGreaterThan(0);
  expect(soft.coverage[12 * 25 + 8]).toBeLessThan(255);
  expect(soft.coverage[12 * 25 + 12]).toBeGreaterThan(230);
  for (let y = 0; y < 25; y++)
    for (let x = 0; x < 25; x++) {
      expect(soft.coverage[y * 25 + x]).toBe(soft.coverage[y * 25 + 24 - x]);
      expect(soft.coverage[y * 25 + x]).toBe(soft.coverage[(24 - y) * 25 + x]);
    }
  const image = createPixels(25, 25);
  fillPixels(image, [20, 40, 60, 255]);
  fillPixels(image, [200, 100, 30, 255], { selection: soft, mode: "source-atop" });
  expect(image.pixels[4 * (12 * 25 + 6)]).toBeGreaterThan(20);
  expect(image.pixels[4 * (12 * 25 + 12)]).toBeGreaterThan(180);
  for (let i = 3; i < image.pixels.length; i += 4) expect(image.pixels[i]).toBe(255);
  const identity = await featherPixelSelection({ ...selection, coverage: original }, 0);
  expect(identity.coverage).toEqual(original);
  expect(identity.coverage).not.toBe(original);
});

it("preserves constant boundary coverage and rejects invalid feather inputs", async () => {
  for (const value of [0, 128, 255]) {
    const input = { width: 7, height: 5, coverage: new Uint8Array(35).fill(value) };
    expect((await featherPixelSelection(input, 3)).coverage).toEqual(input.coverage);
    for (const sigma of [-1, 0.1, 1001, Infinity, NaN])
      await expect(featherPixelSelection(input, sigma)).rejects.toThrow(/sigma/);
  }
  await expect(
    featherPixelSelection({ width: 3, height: 3, coverage: new Uint8Array(8) }, 2),
  ).rejects.toThrow(/coverage byte/);
});

it("saves feathered corrections as editable pixel artwork", async () => {
  const dir = await mkdtemp(join(tmpdir(), "feather-selection-"));
  try {
    const p = StoryboardProject.create({ title: "Feather persistence" }),
      panel = p.addScene("s").addShot("s").addPanel(),
      layer = panel.addRasterLayer("paint");
    const source = createPixels(25, 25);
    fillPixels(source, [20, 40, 60, 255]);
    const id = layer.rasterSurface(source);
    const selection = await featherPixelSelection(
      polygonPixelSelection(25, 25, [
        { x: 8, y: 8 },
        { x: 17, y: 8 },
        { x: 17, y: 17 },
        { x: 8, y: 17 },
      ]),
      2,
    );
    layer.editPixels(id, { x: 0, y: 0, width: 25, height: 25 }, (patch) =>
      fillPixels(patch, [220, 180, 110, 255], { selection, mode: "source-atop" }),
    );
    const edited = layer.readPixels(id),
      file = join(dir, "feather.cboard");
    await p.save(file);
    const reopened = await StoryboardProject.open(file),
      paint = reopened.panel(panel.id).layer(layer.id);
    expect(paint.readPixels(id)).toEqual(edited);
    paint.editPixels(id, { x: 0, y: 0, width: 25, height: 25 }, (patch) =>
      fillPixels(patch, [0, 0, 0, 255], { selection, mode: "destination-out" }),
    );
    expect(paint.readPixels(id).pixels[4 * (12 * 25 + 12) + 3]).toBeLessThan(25);
    reopened.undo();
    expect(paint.readPixels(id)).toEqual(edited);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
