import { afterEach, expect, it, vi } from "vitest";
afterEach(() => vi.restoreAllMocks());

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  StoryboardProject,
  ProjectStore,
  evaluateCamera,
  renderPanelPNG,
  decodePixels,
} from "../../../src/index.js";

it("keys zoom independently from eased pan and preserves IDs and untouched easing", async () => {
  const p = StoryboardProject.create({
    title: "Independent camera",
    width: 100,
    height: 60,
    background: "transparent",
  });
  const shot = p.addScene("S").addShot("S"),
    panel = shot.addPanel({ durationFrames: 21 }),
    layer = panel.addVectorLayer("Ink");
  layer.vectorStroke([{ x: 60, y: 30 }], { color: "red", width: 10, pressureSize: 0 });
  const key = p.production.addCameraKeyframe(shot.id, 0, { x: 0, easing: "ease-in-out" });
  p.production.addCameraKeyframe(shot.id, 20, { x: 20 });
  const pan = Array.from(
    { length: 21 },
    (_, f) => evaluateCamera(p.production.cameraKeyframes(shot.id), f).x,
  );
  expect(p.production.addCameraKeyframe(shot.id, 0, { zoom: 1, easing: "linear" })).toBe(key);
  p.production.addCameraKeyframe(shot.id, 10, { zoom: 2 });
  p.production.addCameraKeyframe(shot.id, 20, { zoom: 1 });
  const keys = p.production.cameraKeyframes(shot.id);
  expect(keys.find((k) => k.frame === 10)).toMatchObject({ zoom: 2 });
  expect(keys.find((k) => k.frame === 10)!.x).toBeUndefined();
  expect(Array.from({ length: 21 }, (_, f) => evaluateCamera(keys, f).x)).toEqual(pan);
  expect(evaluateCamera(keys, 5)).toEqual({ x: 3.125, y: 0, zoom: 1.5, rotation: 0 });
  expect(evaluateCamera(keys, -1)).toEqual({ x: 0, y: 0, zoom: 1, rotation: 0 });
  expect(evaluateCamera([], 50)).toEqual({ x: 0, y: 0, zoom: 1, rotation: 0 });
  const pixels = await decodePixels(
    await renderPanelPNG(p, panel.id, { frame: 10, annotations: false }),
  );
  expect([...pixels.pixels.slice((30 * 100 + 50) * 4, (30 * 100 + 50) * 4 + 4)]).toEqual([
    255, 0, 0, 255,
  ]);
  const spy = vi.spyOn(p, "toJSON").mockImplementation(() => {
    throw new Error("Unbounded document read");
  });
  const page = p.production.cameraKeyframes(shot.id, { limit: 1, offset: 1 });
  expect(page).toHaveLength(1);
  expect(page[0]!.frame).toBe(10);
  page[0]!.zoom = 99;
  expect(p.production.cameraKeyframes(shot.id)[1]!.zoom).toBe(2);
  expect(() => p.production.cameraKeyframes(shot.id, { limit: 0 })).toThrow();
  spy.mockRestore();
});

it("removes camera channels atomically, retains other keys and supports undo and frame moves", () => {
  const p = StoryboardProject.create({ title: "Camera revisions" }),
    shot = p.addScene("S").addShot("S");
  shot.addPanel();
  const a = p.production.addCameraKeyframe(shot.id, 0, { x: 0, zoom: 1, easing: "hold" });
  p.production.addCameraKeyframe(shot.id, 0, { rotation: 0, easing: "linear" });
  p.production.addCameraKeyframe(shot.id, 12, { x: 20 });
  const before = p.toJSON();
  for (const action of [
    () => p.production.addCameraKeyframe(shot.id, 0, {}),
    () => p.production.updateCameraKeyframe(shot.id, a, { channelEasing: { y: "hold" } }),
    () => p.production.updateCameraKeyframe(shot.id, a, { frame: 12 }),
    () => p.production.removeCameraKeyframeChannels(shot.id, a, ["x", "x"]),
    () => p.production.removeCameraKeyframeChannels(shot.id, a, ["y"]),
    () => p.production.updateCameraKeyframe(shot.id, a, { zoom: 0 }),
  ]) {
    expect(action).toThrow();
    expect(p.toJSON()).toEqual(before);
  }
  p.production.removeCameraKeyframeChannels(shot.id, a, ["x", "rotation"]);
  expect(p.production.cameraKeyframes(shot.id)[0]).toMatchObject({
    id: a,
    zoom: 1,
    channelEasing: {},
  });
  expect(p.production.cameraKeyframes(shot.id)[0]!.x).toBeUndefined();
  p.production.updateCameraKeyframe(shot.id, a, { frame: 3 });
  expect(p.production.cameraKeyframes(shot.id)[0]!.id).toBe(a);
  p.production.removeCameraKeyframeChannels(shot.id, a, ["zoom"]);
  expect(p.production.cameraKeyframes(shot.id)).toHaveLength(1);
  p.undo();
  expect(p.production.cameraKeyframes(shot.id)[0]!.zoom).toBe(1);
});

it("persists sparse camera curves through partial panel loading and ripple retiming", async () => {
  const p = StoryboardProject.create({ title: "Persist camera", width: 100, height: 60 }),
    scene = p.addScene("S"),
    shot = scene.addShot("A"),
    panel = shot.addPanel({ durationFrames: 11 }),
    next = scene.addShot("B");
  next.addPanel({ durationFrames: 5 });
  panel.addVectorLayer("Ink").vectorStroke(
    [
      { x: 30, y: 25 },
      { x: 70, y: 35 },
    ],
    { width: 8 },
  );
  const easing = { type: "cubic-bezier" as const, x1: 0.1, y1: 0, x2: 0.3, y2: 1 };
  p.production.addCameraKeyframe(shot.id, 0, { x: 0, easing });
  p.production.addCameraKeyframe(shot.id, 10, { x: 10 });
  p.production.addCameraKeyframe(shot.id, 2, { zoom: 1 });
  p.production.addCameraKeyframe(shot.id, 8, { zoom: 2 });
  p.production.addCameraKeyframe(next.id, 11, { rotation: 0.1 });
  const directory = await mkdtemp(join(tmpdir(), "camera-channels-"));
  try {
    const file = join(directory, "project.cboard");
    await p.save(file);
    const reopened = await StoryboardProject.open(file),
      store = ProjectStore.open(file);
    try {
      for (const frame of [0, 2, 5, 8, 10])
        expect(
          (await renderPanelPNG(store.panelDocument(panel.id), panel.id, { frame })).equals(
            await renderPanelPNG(p, panel.id, { frame }),
          ),
        ).toBe(true);
    } finally {
      store.close();
    }
    const original = evaluateCamera(p.production.cameraKeyframes(shot.id), 5);
    reopened.production.setPanelDuration(panel.id, 21);
    expect(reopened.production.cameraKeyframes(shot.id).map((k) => k.frame)).toEqual([
      0, 4, 16, 20,
    ]);
    expect(evaluateCamera(reopened.production.cameraKeyframes(shot.id), 10)).toEqual(original);
    expect(reopened.production.cameraKeyframes(next.id)[0]!.frame).toBe(21);
    await reopened.save(file);
    const again = await StoryboardProject.open(file);
    expect(again.production.cameraKeyframes(shot.id)).toEqual(
      reopened.production.cameraKeyframes(shot.id),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("copies only affected shot metadata and rolls back mixed camera/artwork transactions", () => {
  const p = StoryboardProject.create({ title: "Scoped camera" }),
    scene = p.addScene("S"),
    a = scene.addShot("A"),
    panel = a.addPanel(),
    layer = panel.addVectorLayer("Ink"),
    b = scene.addShot("B");
  b.addPanel();
  layer.vectorStroke([{ x: 1, y: 1 }], { width: 5 });
  const before = p.toJSON(),
    spy = vi.spyOn(globalThis, "structuredClone");
  p.transaction("Two cameras", () => {
    p.production.addCameraKeyframe(a.id, 0, { zoom: 1 });
    p.production.addCameraKeyframe(a.id, 2, { zoom: 2 });
    p.production.addCameraKeyframe(b.id, 24, { x: 10 });
  });
  const copied = spy.mock.calls.map(([value]) =>
    value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {},
  );
  spy.mockRestore();
  expect(copied.filter((v) => v.id === a.id)).toHaveLength(1);
  expect(copied.filter((v) => v.id === b.id)).toHaveLength(1);
  expect(copied.some((v) => v.panels || v.layers)).toBe(false);
  expect(p.toJSON().panels).toEqual(before.panels);
  p.undo();
  expect(p.toJSON().shots).toEqual(before.shots);
  p.redo();
  const staged = p.toJSON();
  expect(() =>
    p.transaction("Rollback", () => {
      p.production.addCameraKeyframe(a.id, 4, { x: 20 });
      layer.set({ opacity: 0.5 });
      p.production.addCameraKeyframe(b.id, 25, { zoom: 0 });
    }),
  ).toThrow();
  expect(p.toJSON()).toEqual(staged);
  p.transaction("Broaden scope", () => {
    p.production.addCameraKeyframe(a.id, 4, { x: 20 });
    scene.addShot("C");
  });
  p.undo();
  expect(p.toJSON().shots).toEqual(staged.shots);
});
