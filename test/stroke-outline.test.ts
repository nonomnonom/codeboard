import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  StoryboardProject,
  renderPanelPNG,
  renderPanelCanvas,
  decodePixels,
  pathCommands,
  pathContains,
} from "../src/index.js";

it("converts a pressure stroke into an editable outline for partial erasure, retaining identity and undo", async () => {
  const project = StoryboardProject.create({
    title: "Outline",
    width: 96,
    height: 64,
    background: "transparent",
  });
  const panel = project.addScene("S").addShot("S").addPanel(),
    layer = panel.addVectorLayer("Ink");
  const id = layer.vectorStroke(
    [
      { x: 12, y: 32, pressure: 0.2 },
      { x: 32, y: 26, pressure: 0.7 },
      { x: 52, y: 32, pressure: 1 },
      { x: 80, y: 32, pressure: 0.4 },
    ],
    { width: 18, pressureSize: 1, color: "#905020", opacity: 0.7, name: "Contour correction" },
  );
  layer.edit(id, (e) => ({ ...e, matrix: [1, 0, 0, 1, 2, 0] }));
  const source = project.production.element(id),
    before = await renderPanelPNG(project, panel.id);
  const sourcePixels = await decodePixels(before);
  project.transaction("Outline and erase center", () => {
    layer.outlineStroke(id);
    const outline = project.production.element(id);
    expect(outline).toMatchObject({
      id,
      kind: "vector-path",
      name: "Contour correction",
      fill: "#905020",
      opacity: 0.7,
      matrix: [1, 0, 0, 1, 2, 0],
    });
    if (outline.kind !== "vector-path") throw new Error("Expected outline");
    expect(pathContains(outline.commands, 52, 32)).toBe(true);
    const converted = renderPanelCanvas(project, panel.id)
      .getContext("2d")
      .getImageData(0, 0, 96, 64).data;
    let error = 0,
      total = 0;
    for (let i = 3; i < converted.length; i += 4) {
      error += Math.abs(converted[i]! - sourcePixels.pixels[i]!);
      total += sourcePixels.pixels[i]!;
    }
    expect(error).toBeLessThan(total * 0.01);
    layer.booleanPath(id, pathCommands("M 44 0 L 60 0 L 60 64 L 44 64 Z"), "difference");
  });
  const after = await renderPanelPNG(project, panel.id),
    pixels = await decodePixels(after);
  expect(pixels.pixels[(32 * 96 + 54) * 4 + 3]).toBe(0);
  expect(pixels.pixels[(26 * 96 + 34) * 4 + 3]).toBe(sourcePixels.pixels[(26 * 96 + 34) * 4 + 3]);
  project.undo();
  expect(project.production.element(id)).toEqual(source);
  expect((await renderPanelPNG(project, panel.id)).equals(before)).toBe(true);
  project.redo();
  const dir = await mkdtemp(join(tmpdir(), "stroke-outline-"));
  try {
    const file = join(dir, "outline.cboard");
    await project.save(file);
    const reopened = await StoryboardProject.open(file);
    expect((await renderPanelPNG(reopened, panel.id)).equals(after)).toBe(true);
    expect(reopened.production.element(id)).toEqual(project.production.element(id));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it("outlines round dots and refuses multicolor closed fills without changing them", () => {
  const p = StoryboardProject.create({ title: "Dot" }),
    panel = p.addScene("s").addShot("s").addPanel(),
    layer = panel.addVectorLayer("Ink");
  const dot = layer.vectorStroke([{ x: 20, y: 20, pressure: 1 }], { width: 10 });
  layer.outlineStroke(dot);
  const outline = p.production.element(dot);
  if (outline.kind !== "vector-path") throw new Error("Expected outline");
  expect(pathContains(outline.commands, 20, 20)).toBe(true);
  expect(pathContains(outline.commands, 26, 20)).toBe(false);
  layer.booleanPath(dot, pathCommands("M 20 0 L 40 0 L 40 40 L 20 40 Z"), "difference");
  const filled = layer.vectorStroke(
      [
        { x: 10, y: 10 },
        { x: 30, y: 10 },
        { x: 20, y: 30 },
      ],
      { closed: true, fill: "red", color: "blue" },
    ),
    original = p.production.element(filled);
  p.transaction("Caught invalid conversion", () => {
    expect(() => layer.outlineStroke(filled)).toThrow(/separate the fill/);
    expect(p.production.element(filled)).toEqual(original);
    expect(() => layer.outlineStroke(dot)).toThrow(/not a vector stroke/);
  });
});
