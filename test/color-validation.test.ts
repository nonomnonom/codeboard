import { StoryboardProject, brushes, renderPanelPNG, decodePixels } from "../src/index.js";

it("rejects invalid drawing colors before mutation, including caught edits and empty fills", () => {
  const project = StoryboardProject.create({ title: "Colors" }),
    panel = project.addScene("S").addShot("S").addPanel();
  const vector = panel.addVectorLayer("Ink"),
    raster = panel.addRasterLayer("Paint");
  const id = vector.path(
    [
      { op: "M", x: 0, y: 0 },
      { op: "L", x: 10, y: 10 },
    ],
    { stroke: "red", strokeWidth: 2 },
  );
  project.transaction("Correct mistaken colors", () => {
    const before = project.toJSON();
    for (const color of ["mistyped-amber", "#12zz34", "", "none", "currentColor"]) {
      expect(() => vector.path([], { fill: color })).toThrow(/Invalid drawing fill/);
      expect(() => vector.path([], { stroke: color })).toThrow(/Invalid drawing stroke/);
      expect(() => vector.vectorStroke([{ x: 1, y: 1 }], { color })).toThrow(
        /Invalid drawing color/,
      );
      expect(() => raster.rasterStroke([{ x: 1, y: 1 }], brushes.cleanInk, { color })).toThrow(
        /Invalid drawing color/,
      );
      expect(() => vector.text("X", 0, 0, { color })).toThrow(/Invalid drawing color/);
      expect(() => panel.addMotion("Move", { x: 0, y: 0 }, { x: 10, y: 10 }, color)).toThrow(
        /Invalid drawing color/,
      );
      expect(() => vector.edit(id, (e) => ({ ...e, fill: color }))).toThrow(/Invalid drawing fill/);
      expect(project.toJSON()).toEqual(before);
    }
    vector.edit(id, (e) => ({ ...e, stroke: "rebeccapurple" }));
  });
  project.undo();
  expect(project.production.element(id)).toMatchObject({ stroke: "red" });
  project.redo();
  expect(project.production.element(id)).toMatchObject({ stroke: "rebeccapurple" });
});

it("validates imported document colors and renders supported CSS formats unchanged", async () => {
  const project = StoryboardProject.create({
    title: "Supported colors",
    width: 60,
    height: 20,
    background: "transparent",
  });
  const panel = project.addScene("S").addShot("S").addPanel(),
    ink = panel.addVectorLayer("Colors");
  for (const [i, fill] of ["#f00", "rgb(0, 255, 0)", "hsl(240, 100%, 50%)"].entries())
    ink.path(
      [
        { op: "M", x: i * 20, y: 0 },
        { op: "L", x: (i + 1) * 20, y: 0 },
        { op: "L", x: (i + 1) * 20, y: 20 },
        { op: "L", x: i * 20, y: 20 },
        { op: "Z" },
      ],
      { fill },
    );
  const pixels = await decodePixels(
    await renderPanelPNG(project, panel.id, { annotations: false }),
  );
  for (const [i, rgb] of [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
  ].entries()) {
    const at = (10 * 60 + i * 20 + 10) * 4;
    expect([...pixels.pixels.slice(at, at + 4)]).toEqual([...rgb, 255]);
  }
  const document = project.toJSON();
  document.canvas.background = "invalid-paper";
  expect(() => StoryboardProject.fromJSON(document)).toThrow(/Invalid drawing color/);
  await expect(renderPanelPNG(document, panel.id)).rejects.toThrow(
    /Invalid canvas background color/,
  );
  document.canvas.background = "transparent";
  const layer = document.panels[0]!.layers[0]!;
  if (layer.kind === "group") throw new Error("Expected drawing layer");
  const element = layer.elements[0]!;
  if (element.kind !== "vector-path") throw new Error("Expected path");
  element.fill = "broken-ink";
  expect(() => StoryboardProject.fromJSON(document)).toThrow(/Invalid drawing color/);
  await expect(renderPanelPNG(document, panel.id)).rejects.toThrow(/Invalid drawing fill/);
});
