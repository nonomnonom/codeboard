import { expect, it } from "vitest";
import { StoryboardProject } from "../../../../src/index.js";
import { fixture } from "./fixture.js";

it("validates drawing exposures before mutation and on document import", () => {
  const { p, b } = fixture(),
    layer = b.addVectorLayer("Exposure drawing");
  const initial = p.toJSON();
  p.transaction("Correct exposure", () => {
    const before = p.toJSON();
    for (const exposure of [
      { startFrame: 24.5, endFrame: 30 },
      { startFrame: -1, endFrame: 30 },
      { startFrame: NaN, endFrame: 30 },
      { startFrame: 24, endFrame: Infinity },
      { startFrame: 30, endFrame: 30 },
      { startFrame: 31, endFrame: 30 },
    ]) {
      expect(() => p.production.setExposure(layer.id, exposure)).toThrow();
      expect(p.toJSON()).toEqual(before);
    }
    const exposure = { startFrame: 24, endFrame: 30 };
    p.production.setExposure(layer.id, exposure);
    exposure.endFrame = 99;
    expect(p.production.layer(layer.id).exposure).toEqual({ startFrame: 24, endFrame: 30 });
  });
  p.undo();
  expect(p.toJSON().panels).toEqual(initial.panels);
  p.redo();
  p.production.setExposure(layer.id, null);
  expect(p.production.layer(layer.id).exposure).toBeNull();
  for (const exposure of [
    { startFrame: 30, endFrame: 30 },
    { startFrame: 31, endFrame: 30 },
  ]) {
    const raw = p.toJSON();
    raw.panels.find((panel) => panel.id === b.id)!.layers.find((l) => l.id === layer.id)!.exposure =
      exposure;
    expect(() => StoryboardProject.fromJSON(raw)).toThrow(/Exposure end must follow start/);
  }
});

it("rejects invalid audio edits before mutation and permits correction in the same transaction", () => {
  const { p } = fixture(),
    initial = p.toJSON(),
    track = initial.audioTracks[0]!,
    clip = track.clips[0]!;
  p.transaction("Correct audio timing", () => {
    const before = p.toJSON();
    for (const changes of [
      { durationFrames: 0 },
      { sourceInFrame: -1 },
      { startFrame: 1.5 },
      { volume: NaN },
      { durationFrames: 3, fadeInFrames: 2, fadeOutFrames: 2 },
    ]) {
      expect(() => p.production.updateAudioClip(track.id, clip.id, changes)).toThrow();
      expect(p.toJSON()).toEqual(before);
    }
    const { id: _id, ...definition } = clip;
    expect(() =>
      p.production.addAudioClip(track.id, { ...definition, durationFrames: 1, fadeInFrames: 2 }),
    ).toThrow(/fades overlap/);
    expect(p.toJSON()).toEqual(before);
    p.production.updateAudioClip(track.id, clip.id, {
      durationFrames: 6,
      fadeInFrames: 2,
      fadeOutFrames: 2,
    });
  });
  expect(p.toJSON().audioTracks[0]!.clips[0]).toMatchObject({
    id: clip.id,
    durationFrames: 6,
    fadeInFrames: 2,
    fadeOutFrames: 2,
  });
  p.undo();
  expect(p.toJSON().audioTracks).toEqual(initial.audioTracks);
});

it("rejects caught keyframe edits before changing animation or allocating IDs", () => {
  const p = StoryboardProject.create({ title: "Recover keyframes" });
  const shot = p.addScene("S").addShot("A"),
    panel = shot.addPanel(),
    layer = panel.addVectorLayer("Ink");
  const camera = { x: 0, y: 0, zoom: 1, rotation: 0, easing: "linear" as const };
  const a = p.production.addCameraKeyframe(shot.id, 0, camera);
  p.production.addCameraKeyframe(shot.id, 12, camera);
  const b = p.production.addLayerKeyframe(layer.id, 0, { opacity: 1 });
  p.production.addLayerKeyframe(layer.id, 12, { opacity: 0.5 });
  p.transaction("Recover and continue", () => {
    const before = p.toJSON();
    for (const operation of [
      () => p.production.updateCameraKeyframe(shot.id, a, { frame: 12, x: 99 }),
      () => p.production.updateLayerKeyframe(layer.id, b, { frame: 12, opacity: 0.1 }),
      () => p.production.updateCameraKeyframe(shot.id, a, { zoom: 0 }),
      () => p.production.updateLayerKeyframe(layer.id, b, { opacity: 2 }),
      () => p.production.addCameraKeyframe(shot.id, 1.5, camera),
      () => p.production.addLayerKeyframe(layer.id, 1, { opacity: NaN }),
    ]) {
      expect(operation).toThrow();
      expect(p.toJSON()).toEqual(before);
    }
    p.production.updateCameraKeyframe(shot.id, a, { frame: 3, x: 20 });
    p.production.updateLayerKeyframe(layer.id, b, { frame: 3, opacity: 0.8 });
  });
  expect(p.toJSON().shots[0]!.cameraKeyframes[0]).toMatchObject({ id: a, frame: 3, x: 20 });
  expect(p.production.layer(layer.id).keyframes[0]).toMatchObject({
    id: b,
    frame: 3,
    opacity: 0.8,
  });
  p.undo();
  expect(p.production.layer(layer.id).keyframes[0]).toMatchObject({
    id: b,
    frame: 0,
    opacity: 1,
  });
});
