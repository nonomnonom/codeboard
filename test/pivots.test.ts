import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  StoryboardProject,
  createPixels,
  renderPanelPNG,
  decodePixels,
  createRenderSession,
  matrixFromTransform,
  transformPoint,
  pathCommands,
} from "../src/index.js";

it.each(["vector", "raster", "group"] as const)(
  "rotates %s artwork around its persistent pivot with matching coordinate inspection",
  async (kind) => {
    const p = StoryboardProject.create({
      title: "Joint",
      width: 160,
      height: 120,
      background: "transparent",
    });
    const shot = p.addScene("S").addShot("S"),
      panel = shot.addPanel({ durationFrames: 12 });
    const pivot = { x: 80, y: 60 };
    const options = { pivot, depth: 2 };
    const target =
      kind === "group"
        ? panel.addGroup("Joint", options)
        : kind === "raster"
          ? panel.addRasterLayer("Joint", options)
          : panel.addVectorLayer("Joint", options);
    const drawing = kind === "group" ? panel.addVectorLayer("Child", {}, target.id) : target;
    if (kind === "raster") {
      const pixels = createPixels(8, 8);
      for (let i = 0; i < pixels.pixels.length; i += 4) {
        pixels.pixels[i] = 255;
        pixels.pixels[i + 3] = 255;
      }
      drawing.rasterSurface(pixels, { matrix: [1, 0, 0, 1, 86, 56] });
    } else drawing.path(pathCommands("M 86 56 L 94 56 L 94 64 L 86 64 Z"), { fill: "red" });
    pivot.x = 999;
    expect(p.production.layer(target.id).pivot!.x).toBe(80);
    p.production.addLayerKeyframe(target.id, 0, { transform: { rotation: 0 } });
    p.production.addLayerKeyframe(target.id, 10, { transform: { rotation: Math.PI / 2 } });
    p.production.addCameraKeyframe(shot.id, 0, {
      x: 4,
      y: -2,
      zoom: 1.4,
      rotation: 0.1,
      easing: "hold",
    });
    const session = createRenderSession(p);
    for (const frame of [0, 5, 10]) {
      const expected = transformPoint(
        p.production.coordinates(target.id, { frame, camera: false }).localToFrame,
        { x: 90, y: 60 },
      );
      expect(expected.x).toBeCloseTo(80 + 10 * Math.cos(((frame / 10) * Math.PI) / 2));
      expect(expected.y).toBeCloseTo(60 + 10 * Math.sin(((frame / 10) * Math.PI) / 2));
      const point = transformPoint(p.production.coordinates(target.id, { frame }).localToFrame, {
        x: 90,
        y: 60,
      });
      const png = await renderPanelPNG(p, panel.id, { frame, annotations: false }),
        pixels = await decodePixels(png);
      const at = (Math.floor(point.y) * 160 + Math.floor(point.x)) * 4;
      expect([...pixels.pixels.slice(at, at + 4)]).toEqual([255, 0, 0, 255]);
      expect((await session.frame(frame).toBuffer("png")).equals(png)).toBe(true);
    }
    const dir = await mkdtemp(join(tmpdir(), "pivot-"));
    try {
      const file = join(dir, "project.cboard");
      await p.save(file);
      const reopened = await StoryboardProject.open(file);
      expect(
        (await renderPanelPNG(reopened, panel.id, { frame: 10 })).equals(
          await renderPanelPNG(p, panel.id, { frame: 10 }),
        ),
      ).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);

it("uses a hidden mask parent's pivot and permits isolated temporary element pivots", async () => {
  const p = StoryboardProject.create({
    title: "Mask pivot",
    width: 120,
    height: 100,
    background: "transparent",
  });
  const panel = p.addScene("S").addShot("S").addPanel();
  const group = panel.addGroup("Mask pivot", {
    visible: false,
    pivot: { x: 60, y: 30 },
    transform: { rotation: Math.PI / 2 },
  });
  const mask = panel.addVectorLayer("Mask", {}, group.id);
  mask.path(pathCommands("M 76 26 L 84 26 L 84 34 L 76 34 Z"), { fill: "black" });
  const paint = panel.addVectorLayer("Paint", { maskLayerId: mask.id });
  paint.path(pathCommands("M 0 0 L 120 0 L 120 100 L 0 100 Z"), { fill: "red" });
  const rendered = await decodePixels(await renderPanelPNG(p, panel.id, { annotations: false }));
  expect([...rendered.pixels.slice((50 * 120 + 60) * 4, (50 * 120 + 60) * 4 + 4)]).toEqual([
    255, 0, 0, 255,
  ]);
  expect(rendered.pixels[(30 * 120 + 80) * 4 + 3]).toBe(0);
  const ink = panel.addVectorLayer("Selected drawing"),
    id = ink.vectorStroke(
      [
        { x: 20, y: 20 },
        { x: 30, y: 20 },
      ],
      { width: 4 },
    );
  const original = p.production.element(id);
  p.select({ panelId: panel.id, layerId: ink.id, elementIds: [id] }).transform(
    { rotation: Math.PI / 2 },
    { pivot: { x: 20, y: 20 } },
  );
  const changed = p.production.element(id),
    tip = transformPoint(changed.matrix!, { x: 30, y: 20 });
  expect(tip.x).toBeCloseTo(20, 12);
  expect(tip.y).toBeCloseTo(30, 12);
  expect(p.production.layer(ink.id).pivot).toBeUndefined();
  p.undo();
  expect(p.production.element(id)).toEqual(original);
  const before = p.toJSON();
  expect(() => group.set({ pivot: { x: NaN, y: 2 } })).toThrow();
  expect(p.toJSON()).toEqual(before);
  expect(() =>
    p
      .select({ panelId: panel.id, layerId: ink.id })
      .transform({ rotation: 1 }, { pivot: { x: 1, y: 1 } }),
  ).toThrow(/selected elements/);
});

it("keeps the pivot fixed under scale/reflection and translation in the public matrix helper", () => {
  const pivot = { x: 10, y: 20 },
    m = matrixFromTransform({ x: 3, y: -4, rotation: 0.8, scaleX: -2, scaleY: 0.5 }, pivot);
  expect(transformPoint(m, pivot).x).toBeCloseTo(13);
  expect(transformPoint(m, pivot).y).toBeCloseTo(16);
  expect(matrixFromTransform({ x: 1, y: 2 }, { x: 1e200, y: -1e200 })).toEqual([1, 0, -0, 1, 1, 2]);
  expect(() => matrixFromTransform({}, { x: Infinity, y: 0 })).toThrow(/finite/);
});
