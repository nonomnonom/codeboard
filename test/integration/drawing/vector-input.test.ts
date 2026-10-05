import { expect, it } from "vitest";
import {
  StoryboardProject,
  renderPanelPNG,
  decodePixels,
  pathContains,
  type Point,
} from "../../../src/index.js";

it("retains maximum pressure at a stationary vector mark without mutating samples", async () => {
  const p = StoryboardProject.create({
    title: "Stationary pen",
    width: 64,
    height: 64,
    background: "transparent",
  });
  const panel = p.addScene("s").addShot("s").addPanel(),
    layer = panel.addVectorLayer("Ink");
  const points = [
    { x: 32, y: 32, pressure: 0.2, time: 0 },
    { x: 32, y: 32, pressure: 0.9, time: 20 },
    { x: 32, y: 32, pressure: 0.3, time: 40 },
  ];
  const id = layer.vectorStroke(points, {
    width: 20,
    pressureSize: 1,
    color: "#123456",
    opacity: 0.5,
  });
  const source = p.production.element(id),
    actual = await renderPanelPNG(p, panel.id);
  const pixels = await decodePixels(actual);
  expect(pixels.pixels[(32 * 64 + 32) * 4 + 3]).toBeGreaterThan(0);
  expect(pixels.pixels[(32 * 64 + 39) * 4 + 3]).toBeGreaterThan(0);
  expect(pixels.pixels[(32 * 64 + 42) * 4 + 3]).toBe(0);
  expect(p.production.element(id)).toEqual(source);
  layer.edit(id, (e) =>
    e.kind === "vector-stroke" ? { ...e, points: [{ x: 32, y: 32, pressure: 0.9 }] } : e,
  );
  expect((await renderPanelPNG(p, panel.id)).equals(actual)).toBe(true);
  p.undo();
  layer.outlineStroke(id);
  const outline = p.production.element(id);
  if (outline.kind !== "vector-path") throw new Error("Expected dot outline");
  expect(pathContains(outline.commands, 39, 32)).toBe(true);
  p.undo();
  expect(p.production.element(id)).toEqual(source);
});

it("uses stationary pressure changes within a moving stroke and treats omitted pressure as full pressure", async () => {
  const p = StoryboardProject.create({
    title: "Pause during ink",
    width: 64,
    height: 64,
    background: "transparent",
  });
  const panel = p.addScene("s").addShot("s").addPanel(),
    layer = panel.addVectorLayer("Ink");
  const points: Point[] = [
    { x: 8, y: 32, pressure: 0.2 },
    { x: 32, y: 32, pressure: 0.1 },
    { x: 32, y: 32 },
    { x: 32, y: 32, pressure: 0.3 },
    { x: 56, y: 32, pressure: 0.2 },
  ];
  const id = layer.vectorStroke(points, {
    width: 20,
    pressureSize: 1,
    taperStart: 0.2,
    taperEnd: 0.2,
  });
  const before = await renderPanelPNG(p, panel.id),
    source = p.production.element(id);
  layer.edit(id, (e) =>
    e.kind === "vector-stroke"
      ? { ...e, points: [points[0]!, { x: 32, y: 32, pressure: 1 }, points[4]!] }
      : e,
  );
  expect((await renderPanelPNG(p, panel.id)).equals(before)).toBe(true);
  p.undo();
  expect(p.production.element(id)).toEqual(source);
});
