import {
  StoryboardProject,
  renderCompositionGuides,
  renderPanelPNG,
  decodePixels,
} from "../src/index.js";

it("renders frame-space guides without changing artwork or animation", async () => {
  const project = StoryboardProject.create({
    title: "Framing",
    width: 300,
    height: 180,
    background: "#ffffff",
  });
  const panel = project.addScene("S").addShot("A").addPanel(),
    layer = panel.addVectorLayer("Moving drawing");
  layer.path(
    [{ op: "M", x: 5, y: 5 }, { op: "L", x: 20, y: 5 }, { op: "L", x: 20, y: 20 }, { op: "Z" }],
    { fill: "#000000" },
  );
  project.production.addLayerKeyframe(layer.id, 0, { transform: { x: 0 } });
  project.production.addLayerKeyframe(layer.id, 10, { transform: { x: 40 } });
  const before = project.toJSON(),
    plain = await renderPanelPNG(project, panel.id, { frame: 8, annotations: false });
  expect(
    (await renderCompositionGuides(project, panel.id, { frame: 8, thirds: false })).equals(plain),
  ).toBe(true);
  const guided = await renderCompositionGuides(project, panel.id, {
    frame: 8,
    safeInset: 0.1,
    horizonY: 90,
    vanishingPoints: [{ x: 150, y: 90 }],
  });
  const pixels = await decodePixels(guided),
    original = await decodePixels(plain);
  for (const [x, y] of [
    [100, 40],
    [30, 80],
    [75, 90],
    [240, 144],
  ]) {
    const at = (y! * 300 + x!) * 4;
    expect([...pixels.pixels.slice(at, at + 3)]).not.toEqual([
      ...original.pixels.slice(at, at + 3),
    ]);
  }
  expect(project.toJSON()).toEqual(before);
  expect(
    (await renderPanelPNG(project, panel.id, { frame: 8, annotations: false })).equals(plain),
  ).toBe(true);
});

it("rejects invalid guide geometry and permits off-frame perspective points", async () => {
  const project = StoryboardProject.create({ title: "Guide validation", width: 80, height: 60 });
  const panel = project.addScene("S").addShot("A").addPanel();
  for (const options of [
    { frame: 0.5 },
    { frame: -1 },
    { safeInset: 0.5 },
    { safeInset: -0.1 },
    { safeInset: NaN },
    { horizonY: Infinity },
    { vanishingPoints: [{ x: NaN, y: 2 }] },
  ]) {
    await expect(renderCompositionGuides(project, panel.id, options)).rejects.toThrow(
      /Guide|Render frame/,
    );
  }
  expect(
    (await renderCompositionGuides(project, panel.id, { vanishingPoints: [{ x: -120, y: 30 }] }))
      .length,
  ).toBeGreaterThan(0);
});
