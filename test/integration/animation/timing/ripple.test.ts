import { expect, it } from "vitest";
import { StoryboardProject, ShotHandle } from "../../../../src/index.js";
import { fixture } from "./fixture.js";

it("ripples across shots, scales keys, moves later audio without stretching sound", () => {
  const { p, a, b } = fixture();
  p.production.setPanelDuration(a.id, 48);
  const doc = p.toJSON();
  expect(doc.panels.find((x) => x.id === b.id)?.startFrame).toBe(48);
  expect(doc.panels[1]!.durationFrames).toBe(48);
  expect(doc.panels[1]!.layers[0]!.keyframes[0]!.frame).toBe(48);
  expect(doc.shots[0]!.cameraKeyframes[0]!.frame).toBe(47);
  expect(doc.audioTracks[0]!.clips[0]).toMatchObject({
    startFrame: 48,
    sourceInFrame: 3,
    durationFrames: 12,
  });
  p.undo();
  expect(p.toJSON().panels[1]!.startFrame).toBe(24);
});

it("uses the same invariant through panel.revise", () => {
  const { p, a } = fixture();
  a.revise({ durationFrames: 36 });
  expect(p.toJSON().panels[1]!.startFrame).toBe(36);
});

it("rolls back a retime when keyframes collide", () => {
  const { p, a } = fixture();
  const layer = a.addVectorLayer("Ink");
  p.production.addLayerKeyframe(layer.id, 0, { opacity: 0 });
  p.production.addLayerKeyframe(layer.id, 1, { opacity: 1 });
  const before = p.toJSON();
  expect(() => p.production.setPanelDuration(a.id, 1)).toThrow(/collapses/);
  expect(p.toJSON()).toEqual(before);
});

it("leaves every timing value unchanged when a locked-audio failure is caught", () => {
  const { p, a } = fixture(),
    document = p.toJSON();
  document.audioTracks[0]!.locked = true;
  const locked = StoryboardProject.fromJSON(document);
  locked.transaction("Handle locked audio", () => {
    const before = locked.toJSON();
    expect(() => locked.production.setPanelDuration(a.id, 48)).toThrow(/locked audio/);
    expect(locked.toJSON()).toEqual(before);
    locked.setMetadata("handled", "yes");
  });
  expect(locked.toJSON().metadata.handled).toBe("yes");
});

it("restores panel structure and allocated IDs after caught reflow failures", () => {
  const p = StoryboardProject.create({ title: "Panel reflow" }),
    shot = p.addScene("S").addShot("Shot");
  const a = shot.addPanel({ id: "a", durationFrames: 24 }),
    b = shot.addPanel({ id: "b", durationFrames: 24 });
  p.production.comment("Keep this contact", { panelId: b.id, frame: 27 });
  const asset = p.production.addAsset({
    name: "Cue",
    kind: "audio",
    path: "cue.wav",
    mimeType: "audio/wav",
    source: "linked",
  });
  const track = p.production.addAudioTrack("Locked cue");
  p.production.addAudioClip(track, {
    assetId: asset,
    name: "Cue",
    startFrame: 24,
    sourceInFrame: 0,
    durationFrames: 4,
    volume: 1,
    fadeInFrames: 0,
    fadeOutFrames: 0,
  });
  const document = p.toJSON();
  document.audioTracks[0]!.locked = true;
  const locked = StoryboardProject.fromJSON(document);
  locked.transaction("Reject structural edits", () => {
    const before = locked.toJSON();
    for (const operation of [
      () => locked.production.movePanel(b.id, a.id),
      () => locked.production.duplicatePanel(a.id),
      () => locked.production.deletePanel(a.id),
    ]) {
      expect(operation).toThrow(/locked/i);
      expect(locked.toJSON()).toEqual(before);
    }
    locked.setMetadata("handled", "yes");
  });
  expect(locked.toJSON().metadata.handled).toBe("yes");
});

it("restores an insertion into an earlier shot when downstream audio cannot move", () => {
  const { p } = fixture(),
    document = p.toJSON();
  document.audioTracks[0]!.locked = true;
  const locked = StoryboardProject.fromJSON(document),
    shot = new ShotHandle(locked, document.shots[0]!.id);
  locked.transaction("Handle insertion failure", () => {
    const before = locked.toJSON();
    expect(() => shot.addPanel()).toThrow(/locked/i);
    expect(locked.toJSON()).toEqual(before);
    locked.setMetadata("handled", "yes");
  });
  expect(locked.toJSON().metadata.handled).toBe("yes");
});
