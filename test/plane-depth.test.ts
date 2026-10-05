import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  StoryboardProject,
  ProjectStore,
  evaluateLayer,
  renderPanelPNG,
  createRenderSession,
  decodePixels,
  pathCommands,
  transformPoint,
} from "../src/index.js";

it("revises root-plane parallax while retaining nested artwork, camera-free composition and persistence", async () => {
  const p = StoryboardProject.create({
    title: "Plane correction",
    width: 120,
    height: 100,
    background: "transparent",
  });
  const shot = p.addScene("S").addShot("S"),
    panel = shot.addPanel();
  const root = panel.addGroup("Midground", { opacity: 0.5, depth: 1 }),
    child = panel.addVectorLayer("Ink", { transform: { x: 10 } }, root.id);
  const element = child.path(pathCommands("M 55 45 L 65 45 L 65 55 L 55 55 Z"), { fill: "red" });
  p.production.addCameraKeyframe(shot.id, 0, { x: 40, zoom: 1 });
  const before = p.toJSON(),
    original = await renderPanelPNG(p, panel.id),
    flat = await renderPanelPNG(p, panel.id, { camera: false });
  p.transaction("Correct plane", () => {
    for (const action of [
      () => p.production.setPlaneDepth(child.id, 2),
      () => p.production.setPlaneDepth(root.id, 0),
      () => p.production.setPlaneDepth(root.id, Infinity),
    ]) {
      const unchanged = p.toJSON();
      expect(action).toThrow();
      expect(p.toJSON()).toEqual(unchanged);
    }
    p.production.setPlaneDepth(root.id, 2);
  });
  expect(p.production.layer(root.id).depth).toBe(2);
  expect(transformPoint(p.production.coordinates(element).localToFrame, { x: 60, y: 50 })).toEqual({
    x: 50,
    y: 50,
  });
  expect(await renderPanelPNG(p, panel.id, { camera: false })).toEqual(flat);
  const revised = await renderPanelPNG(p, panel.id),
    pixels = await decodePixels(revised);
  expect([...pixels.pixels.slice((50 * 120 + 50) * 4, (50 * 120 + 50) * 4 + 4)]).toEqual([
    255, 0, 0, 128,
  ]);
  expect(pixels.pixels[(50 * 120 + 30) * 4 + 3]).toBe(0);
  expect(await createRenderSession(p).panel(panel.id).toBuffer("png")).toEqual(revised);
  const sourceRoot = before.panels[0]!.layers[0]!;
  expect({ ...p.production.layer(root.id), depth: 1 }).toEqual(sourceRoot);
  p.undo();
  expect(await renderPanelPNG(p, panel.id)).toEqual(original);
  p.redo();
  const dir = await mkdtemp(join(tmpdir(), "plane-depth-"));
  try {
    const file = join(dir, "plane.cboard");
    await p.save(file);
    expect(await renderPanelPNG(await StoryboardProject.open(file), panel.id)).toEqual(revised);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it("animates depth independently through masked cached renders, channel editing, retiming and partial loading", async () => {
  const p = StoryboardProject.create({
    title: "Animated depth",
    width: 120,
    height: 100,
    background: "transparent",
  });
  const shot = p.addScene("S").addShot("S"),
    panel = shot.addPanel({ durationFrames: 11 }),
    root = panel.addGroup("Plane", { opacity: 0.5 });
  const mask = panel.addVectorLayer("Mask", { visible: false }, root.id);
  mask.path(pathCommands("M 65 45 L 75 45 L 75 55 L 65 55 Z"), { fill: "black" });
  const ink = panel.addVectorLayer("Ink", { maskLayerId: mask.id }, root.id),
    element = ink.path(pathCommands("M 0 0 L 120 0 L 120 100 L 0 100 Z"), { fill: "red" });
  p.production.addCameraKeyframe(shot.id, 0, { x: 10, zoom: 4 });
  const first = p.production.addLayerKeyframe(root.id, 0, { depth: 1 }),
    last = p.production.addLayerKeyframe(root.id, 10, { depth: 3 });
  p.production.addLayerKeyframe(root.id, 5, { opacity: 0.5, easing: "hold" });
  expect(evaluateLayer(p.production.layer(root.id), 5).depth).toBe(2);
  const session = createRenderSession(p),
    images = [];
  for (const frame of [0, 5, 10]) {
    const depth = 1 + frame / 5,
      position = transformPoint(p.production.coordinates(element, { frame }).localToFrame, {
        x: 70,
        y: 50,
      });
    expect(position.x).toBeCloseTo(60 + 4 ** (1 / depth) * (10 - 10 / depth), 10);
    const image = await renderPanelPNG(p, panel.id, { frame, annotations: false });
    images.push(image);
    expect(await session.frame(frame).toBuffer("png")).toEqual(image);
    const pixels = await decodePixels(image),
      at = (50 * 120 + Math.floor(position.x)) * 4;
    expect([...pixels.pixels.slice(at, at + 4)]).toEqual([255, 0, 0, 128]);
  }
  const holder = panel.addGroup("Another root");
  p.transaction("Invalid depth operations", () => {
    for (const action of [
      () => p.production.addLayerKeyframe(ink.id, 0, { depth: 2 }),
      () => p.production.updateLayerKeyframe(root.id, last, { depth: 0 }),
      () => p.production.reparentLayer(root.id, holder.id),
    ]) {
      const before = p.toJSON();
      expect(action).toThrow();
      expect(p.toJSON()).toEqual(before);
    }
  });
  p.production.updateLayerKeyframe(root.id, first, { channelEasing: { depth: "hold" } });
  expect(evaluateLayer(p.production.layer(root.id), 5).depth).toBe(1);
  p.undo();
  const dir = await mkdtemp(join(tmpdir(), "depth-keys-"));
  try {
    const file = join(dir, "depth.cboard");
    await p.save(file);
    const store = ProjectStore.open(file);
    try {
      expect(
        await renderPanelPNG(store.panelDocument(panel.id), panel.id, {
          frame: 5,
          annotations: false,
        }),
      ).toEqual(images[1]);
    } finally {
      store.close();
    }
    const opened = await StoryboardProject.open(file);
    opened.production.setPanelDuration(panel.id, 21);
    expect(opened.production.layerKeyframes(root.id).map((key) => key.frame)).toEqual([0, 10, 20]);
    expect(await renderPanelPNG(opened, panel.id, { frame: 10, annotations: false })).toEqual(
      images[1],
    );
    opened.production.removeLayerKeyframeChannels(root.id, first, ["depth"]);
    expect(opened.production.layerKeyframes(root.id).some((key) => key.id === first)).toBe(false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it.each([2, 0.5])(
  "rejects unrepresentable camera zoom %s/depth consistently before native composition",
  async (zoom) => {
    const p = StoryboardProject.create({ title: "Numerical depth", width: 32, height: 32 });
    const shot = p.addScene("S").addShot("S"),
      panel = shot.addPanel(),
      ink = panel.addVectorLayer("Plane");
    ink.path(pathCommands("M 0 0 L 20 0 L 20 20 Z"), { fill: "black" });
    p.production.addCameraKeyframe(shot.id, 0, { zoom });
    p.production.addLayerKeyframe(ink.id, 0, { depth: 1e-300 });
    const before = p.toJSON();
    expect(() => p.production.coordinates(ink.id)).toThrow(/supported numerical range/);
    await expect(renderPanelPNG(p, panel.id)).rejects.toThrow(/supported numerical range/);
    expect(() => createRenderSession(p).frame(0)).toThrow(/supported numerical range/);
    expect(p.toJSON()).toEqual(before);
    expect(await renderPanelPNG(p, panel.id, { camera: false })).toBeInstanceOf(Buffer);
    p.production.updateLayerKeyframe(ink.id, p.production.layerKeyframes(ink.id)[0]!.id, {
      depth: 1,
    });
    expect(await renderPanelPNG(p, panel.id)).toBeInstanceOf(Buffer);
  },
);
