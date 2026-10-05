afterEach(() => jest.restoreAllMocks());

import {
  StoryboardProject,
  renderPanelPNG,
  renderDetail,
  renderOnionSkin,
  pathCommands,
} from "../src/index.js";

it("renders selected panels without full project snapshots and retains camera/mask parity", async () => {
  const p = StoryboardProject.create({ title: "Targeted render", width: 80, height: 60 });
  const shot = p.addScene("S").addShot("S"),
    panel = shot.addPanel({ durationFrames: 12 }),
    other = shot.addPanel({ durationFrames: 12 });
  const mask = panel.addVectorLayer("Mask");
  mask.path(pathCommands("M 5 5 L 45 5 L 45 40 L 5 40 Z"), { fill: "black" });
  const paint = panel.addVectorLayer("Paint", { maskLayerId: mask.id });
  paint.path(pathCommands("M 0 0 L 80 0 L 80 60 L 0 60 Z"), { fill: "red" });
  other.addVectorLayer("Unrelated").path(pathCommands("M 0 0 L 80 0 L 80 60 Z"), { fill: "blue" });
  p.production.addCameraKeyframe(shot.id, 0, { x: 7, zoom: 1.2 });
  const full = p.toJSON(),
    samples = [{ panelId: panel.id, frame: 3, layerIds: [paint.id], tint: "blue" }],
    crop = { x: 3, y: 4, width: 40, height: 30 };
  const reference = [
    await renderPanelPNG(full, panel.id, { frame: 3 }),
    await renderDetail(full, panel.id, crop, 3),
    await renderOnionSkin(full, samples),
  ];
  const snapshots = jest.spyOn(p, "_readRenderPanels"),
    fullSnapshot = jest.spyOn(p, "toJSON").mockImplementation(() => {
      throw new Error("Whole document copied");
    });
  try {
    expect(await renderPanelPNG(p, panel.id, { frame: 3 })).toEqual(reference[0]);
    expect(await renderDetail(p, panel.id, crop, 3)).toEqual(reference[1]);
    expect(await renderOnionSkin(p, samples)).toEqual(reference[2]);
    for (const result of snapshots.mock.results) {
      expect(result.type).toBe("return");
      if (result.type !== "return") throw new Error("Snapshot did not return");
      expect(result.value.panels.map((entry: { id: string }) => entry.id)).toEqual([panel.id]);
      expect(Object.keys(result.value).sort()).toEqual(["canvas", "panels", "shots"]);
    }
    const copy = p._readRenderPanels([panel.id, panel.id]);
    expect(copy.panels).toHaveLength(1);
    copy.panels[0]!.layers.length = 0;
    copy.shots[0]!.cameraKeyframes.length = 0;
    copy.canvas.background = "green";
    expect(await renderPanelPNG(p, panel.id, { frame: 3 })).toEqual(reference[0]);
    expect(() => p._readRenderPanels(["missing"])).toThrow();
  } finally {
    snapshots.mockRestore();
    fullSnapshot.mockRestore();
  }
  expect(p.toJSON()).toEqual(full);
});
