afterEach(() => jest.restoreAllMocks());

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  StoryboardProject,
  evaluateLayer,
  evaluateCamera,
  renderPanelPNG,
  decodePixels,
  ProjectStore,
} from "../src/index.js";

it("keeps eased motion independent of opacity keys, including different easing at the same frame", async () => {
  const p = StoryboardProject.create({
    title: "Independent channels",
    width: 100,
    height: 60,
    background: "transparent",
  });
  const panel = p.addScene("S").addShot("S").addPanel({ durationFrames: 21 }),
    layer = panel.addVectorLayer("Moving ink", { transform: { y: 5 }, opacity: 0.8 });
  layer.vectorStroke([{ x: 10, y: 25 }], { color: "red", width: 12, pressureSize: 0 });
  const start = p.production.addLayerKeyframe(layer.id, 0, {
    transform: { x: 0 },
    easing: "ease-in-out",
  });
  p.production.addLayerKeyframe(layer.id, 20, { transform: { x: 60 } });
  const positions = Array.from(
    { length: 21 },
    (_, f) => evaluateLayer(p.production.layer(layer.id), f).transform.x,
  );
  expect(p.production.addLayerKeyframe(layer.id, 0, { opacity: 1, easing: "linear" })).toBe(start);
  expect(p.production.layerKeyframes(layer.id)).toHaveLength(2);
  p.production.addLayerKeyframe(layer.id, 10, { opacity: 0.25 });
  p.production.addLayerKeyframe(layer.id, 20, { opacity: 1 });
  const read = p.production.layer(layer.id);
  expect(Array.from({ length: 21 }, (_, f) => evaluateLayer(read, f).transform.x)).toEqual(
    positions,
  );
  expect(read.keyframes.find((k) => k.frame === 10)).toMatchObject({
    transform: {},
    opacity: 0.25,
  });
  expect(evaluateLayer(read, 5)).toEqual({
    transform: { x: 9.375, y: 5, scaleX: 1, scaleY: 1, rotation: 0 },
    opacity: 0.625,
    depth: 1,
  });
  const pixels = await decodePixels(
    await renderPanelPNG(p, panel.id, { frame: 10, annotations: false }),
  );
  expect([...pixels.pixels.slice((30 * 100 + 40) * 4, (30 * 100 + 40) * 4 + 4)]).toEqual([
    255, 0, 0, 64,
  ]);
  const spy = jest.spyOn(p, "toJSON").mockImplementation(() => {
    throw new Error("Whole document read");
  });
  const page = p.production.layerKeyframes(layer.id, { limit: 1, offset: 1 });
  expect(page).toHaveLength(1);
  expect(page[0]!.frame).toBe(10);
  page[0]!.opacity = 1;
  expect(p.production.layerKeyframes(layer.id, { limit: 1, offset: 1 })[0]!.opacity).toBe(0.25);
  expect(() => p.production.layerKeyframes(layer.id, { offset: -1 })).toThrow(/offset/);
  spy.mockRestore();
});

it("removes selected channels without deleting other animation, and rejects invalid edits atomically", () => {
  const p = StoryboardProject.create({ title: "Channel revisions" }),
    shot = p.addScene("S").addShot("S"),
    panel = shot.addPanel(),
    layer = panel.addVectorLayer("Ink");
  const key = p.production.addLayerKeyframe(layer.id, 0, {
    transform: { x: 10 },
    opacity: 0.5,
    easing: "hold",
  });
  p.production.addLayerKeyframe(layer.id, 0, { transform: { rotation: 0.3 }, easing: "linear" });
  const before = p.toJSON();
  for (const operation of [
    () => p.production.addLayerKeyframe(layer.id, 12, {}),
    () => p.production.removeLayerKeyframeChannels(layer.id, key, ["x", "x"]),
    () => p.production.removeLayerKeyframeChannels(layer.id, key, ["y"]),
    () => p.production.updateLayerKeyframe(layer.id, key, { channelEasing: { y: "hold" } }),
    () => p.production.updateLayerKeyframe(layer.id, key, { transform: { x: Infinity } }),
  ]) {
    expect(operation).toThrow();
    expect(p.toJSON()).toEqual(before);
  }
  p.production.removeLayerKeyframeChannels(layer.id, key, ["rotation"]);
  expect(p.production.layerKeyframes(layer.id)[0]).toMatchObject({
    id: key,
    transform: { x: 10 },
    opacity: 0.5,
    channelEasing: {},
  });
  p.undo();
  expect(p.production.layerKeyframes(layer.id)[0]!.transform.rotation).toBe(0.3);
  p.production.removeLayerKeyframeChannels(layer.id, key, ["x", "rotation"]);
  expect(p.production.layerKeyframes(layer.id)[0]!.transform).toEqual({});
  p.production.removeLayerKeyframeChannels(layer.id, key, ["opacity"]);
  expect(p.production.layerKeyframes(layer.id)).toEqual([]);
  const camera = { x: 0, y: 0, zoom: 1, rotation: 0, easing: "linear" as const };
  const cameraId = p.production.addCameraKeyframe(shot.id, 0, camera);
  expect(p.production.addCameraKeyframe(shot.id, 0, { ...camera, x: 20 })).toBe(cameraId);
  expect(p.toJSON().shots[0]!.cameraKeyframes).toHaveLength(1);
});

it("persists sparse property keys and preserves their values through partial reads and retiming", async () => {
  const p = StoryboardProject.create({ title: "Persist channel timing", width: 80, height: 60 });
  const panel = p.addScene("S").addShot("S").addPanel({ durationFrames: 12 }),
    layer = panel.addVectorLayer("Ink");
  layer.vectorStroke(
    [
      { x: 5, y: 25 },
      { x: 25, y: 25 },
    ],
    { width: 10 },
  );
  p.production.addLayerKeyframe(layer.id, 0, {
    transform: { x: 0 },
    easing: { type: "cubic-bezier", x1: 0, y1: 0, x2: 0, y2: 1 },
  });
  p.production.addLayerKeyframe(layer.id, 11, { transform: { x: 40 } });
  p.production.addLayerKeyframe(layer.id, 3, { opacity: 0.25 });
  p.production.addLayerKeyframe(layer.id, 8, { opacity: 1 });
  const dir = await mkdtemp(join(tmpdir(), "channel-keys-"));
  try {
    const file = join(dir, "project.cboard");
    await p.save(file);
    const reopened = await StoryboardProject.open(file),
      store = ProjectStore.open(file);
    try {
      for (const frame of [0, 3, 5, 8, 11])
        expect(
          (await renderPanelPNG(store.panelDocument(panel.id), panel.id, { frame })).equals(
            await renderPanelPNG(p, panel.id, { frame }),
          ),
        ).toBe(true);
    } finally {
      store.close();
    }
    expect(reopened.production.layerKeyframes(layer.id)).toEqual(
      p.production.layerKeyframes(layer.id),
    );
    reopened.production.setPanelDuration(panel.id, 23);
    expect(reopened.production.layerKeyframes(layer.id).map((k) => k.frame)).toEqual([
      0, 6, 16, 22,
    ]);
    const at = evaluateLayer(reopened.production.layer(layer.id), 10),
      original = evaluateLayer(p.production.layer(layer.id), 5);
    expect(at).toEqual(original);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it("solves cubic timing handles for independent layer and camera values, including flat tangents", async () => {
  const p = StoryboardProject.create({
    title: "Curve handles",
    width: 100,
    height: 60,
    background: "transparent",
  });
  const shot = p.addScene("S").addShot("S"),
    panel = shot.addPanel({ durationFrames: 65 }),
    layer = panel.addVectorLayer("Ink");
  layer.vectorStroke([{ x: 10, y: 25 }], { color: "red", width: 10, pressureSize: 0 });
  const curve = { type: "cubic-bezier" as const, x1: 0, y1: 0, x2: 0, y2: 1 };
  const id = p.production.addLayerKeyframe(layer.id, 0, { transform: { x: 0 }, easing: curve });
  p.production.addLayerKeyframe(layer.id, 64, { transform: { x: 60 } });
  p.production.addLayerKeyframe(layer.id, 0, { opacity: 0, easing: "linear" });
  p.production.addLayerKeyframe(layer.id, 64, { opacity: 1 });
  p.production.addCameraKeyframe(shot.id, 0, { x: 0, y: 0, zoom: 1, rotation: 0, easing: curve });
  p.production.addCameraKeyframe(shot.id, 64, {
    x: 80,
    y: 40,
    zoom: 2,
    rotation: 1,
    easing: "linear",
  });
  curve.y2 = 0; // Input ownership must also cover nested handle objects.
  const read = p.production.layer(layer.id);
  for (const [frame, progress] of [
    [0, 0],
    [1, 0.15625],
    [8, 0.5],
    [27, 0.84375],
    [64, 1],
  ] as const) {
    expect(evaluateLayer(read, frame).transform.x).toBeCloseTo(60 * progress, 10);
    expect(evaluateLayer(read, frame).opacity).toBe(frame / 64);
    expect(evaluateCamera(p.toJSON().shots[0]!.cameraKeyframes, frame).zoom).toBeCloseTo(
      1 + progress,
      10,
    );
  }
  const pixels = await decodePixels(
    await renderPanelPNG(p, panel.id, { frame: 8, camera: false, annotations: false }),
  );
  expect([...pixels.pixels.slice((25 * 100 + 40) * 4, (25 * 100 + 40) * 4 + 4)]).toEqual([
    255, 0, 0, 32,
  ]);
  p.production.updateLayerKeyframe(layer.id, id, {
    easing: { type: "cubic-bezier", x1: 1, y1: 0, x2: 1, y2: 1 },
  });
  expect(evaluateLayer(p.production.layer(layer.id), 56).transform.x).toBeCloseTo(30, 10);
  expect(evaluateLayer(p.production.layer(layer.id), 56).opacity).toBe(0.875);
  p.undo();
  expect(p.production.layer(layer.id)).toEqual(read);
});

it("rejects invalid curve handles and unsupported fields before modifying animation", () => {
  const p = StoryboardProject.create({ title: "Validate handles" }),
    shot = p.addScene("S").addShot("S"),
    panel = shot.addPanel(),
    layer = panel.addVectorLayer("Ink");
  const key = p.production.addLayerKeyframe(layer.id, 0, { transform: { x: 0 } }),
    before = p.toJSON();
  for (const patch of [
    { x1: -0.1 },
    { x2: 1.1 },
    { y1: NaN },
    { y2: Infinity },
    { y2: 1.1 },
    { extra: 0 },
  ]) {
    const easing = { type: "cubic-bezier" as const, x1: 0.3, y1: 0, x2: 0.7, y2: 1, ...patch };
    expect(() =>
      p.production.updateLayerKeyframe(layer.id, key, { channelEasing: { x: easing } }),
    ).toThrow();
    expect(() =>
      p.production.addCameraKeyframe(shot.id, 0, { x: 0, y: 0, zoom: 1, rotation: 0, easing }),
    ).toThrow();
    expect(p.toJSON()).toEqual(before);
  }
});
