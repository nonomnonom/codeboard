import { StoryboardProject, ShotHandle } from "../src/index.js";

function fixture() {
  const p = StoryboardProject.create({ title: "Retime" });
  const scene = p.addScene("City");
  const shot = scene.addShot("Repair");
  const a = shot.addPanel({ durationFrames: 24 });
  const b = scene.addShot("Flight").addPanel({ durationFrames: 48 });
  const layer = b.addVectorLayer("Wings");
  p.production.addLayerKeyframe(layer.id, 24, { opacity: 0 });
  p.production.addCameraKeyframe(shot.id, 23, {
    x: 10,
    y: 0,
    zoom: 1.2,
    rotation: 0,
    easing: "linear",
  });
  const asset = p.production.addAsset({
    kind: "audio",
    name: "Click",
    path: "click.wav",
    source: "linked",
    mimeType: "audio/wav",
  });
  const track = p.production.addAudioTrack("Mechanism");
  p.production.addAudioClip(track, {
    assetId: asset,
    name: "Click",
    startFrame: 24,
    sourceInFrame: 3,
    durationFrames: 12,
    volume: 1,
    fadeInFrames: 0,
    fadeOutFrames: 0,
  });
  return { p, a, b };
}

describe("global frame retiming", () => {
  it("rounds large but representable key positions using the exact frame ratio", () => {
    const p = StoryboardProject.create({ title: "Frame precision" }),
      panel = p.addScene("S").addShot("S").addPanel({ durationFrames: 4 });
    const layer = panel.addVectorLayer("Ink");
    p.production.addLayerKeyframe(layer.id, 1, { opacity: 0.5 });
    p.production.setPanelDuration(panel.id, 9007199254739999);
    expect(p.production.layer(layer.id).keyframes[0]!.frame).toBe(3002399751579999);
  });
  it("rejects unsafe timing and unknown modes before a caught failure can affect an enclosing transaction", () => {
    const { p, a } = fixture();
    p.transaction("Recover from invalid timing", () => {
      const before = p.toJSON();
      for (const action of [
        () => p.production.setPanelDuration(a.id, Number.MAX_SAFE_INTEGER + 1),
        () => p.production.setPanelDuration(a.id, Number.MAX_SAFE_INTEGER),
        () => p.production.setPanelDuration(a.id, 48, "unknown" as never),
        () => a.revise({ durationFrames: Number.MAX_SAFE_INTEGER }),
      ]) {
        expect(action).toThrow(/safe integer|Unknown retiming/);
        expect(p.toJSON()).toEqual(before);
      }
      p.production.setPanelDuration(a.id, 36);
    });
    expect(p.toJSON().panels[1]!.startFrame).toBe(36);
    p.undo();
    expect(p.toJSON().panels[1]!.startFrame).toBe(24);
  });
  it("preflights far-future key overflow before moving any ordinary key or audio cue", () => {
    const { p, a, b } = fixture(),
      layer = b.addVectorLayer("Later key");
    p.production.addLayerKeyframe(layer.id, Number.MAX_SAFE_INTEGER - 1, { opacity: 0.5 });
    p.transaction("Recover from overflow", () => {
      const before = p.toJSON();
      expect(() => p.production.setPanelDuration(a.id, 48)).toThrow(/safe integer/);
      expect(p.toJSON()).toEqual(before);
      b.revise({ title: "Still editable" });
    });
    expect(p.toJSON().panels[1]!.title).toBe("Still editable");
  });
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
      raw.panels
        .find((panel) => panel.id === b.id)!
        .layers.find((l) => l.id === layer.id)!.exposure = exposure;
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
  it("keeps review frames with their content through reorder, duplication, deletion and undo", () => {
    const p = StoryboardProject.create({ title: "Review timing" }),
      shot = p.addScene("S").addShot("Shot");
    const a = shot.addPanel({ id: "a", durationFrames: 24 }),
      b = shot.addPanel({ id: "b", durationFrames: 48 });
    const anchored = p.production.comment("Check the hand", {
      panelId: b.id,
      frame: 30,
      x: 120,
      y: 80,
    });
    const timed = p.production.comment("Check the cue", { frame: 24 });
    p.production.comment("General composition", { panelId: b.id });
    const original = p.toJSON().comments;
    p.production.movePanel(b.id, a.id);
    expect(p.toJSON().comments.find((c) => c.id === anchored)?.anchor).toEqual({
      panelId: b.id,
      frame: 6,
      x: 120,
      y: 80,
    });
    expect(p.toJSON().comments.find((c) => c.id === timed)?.anchor.frame).toBe(0);
    p.undo();
    expect(p.toJSON().comments).toEqual(original);
    p.redo();
    expect(p.toJSON().comments.find((c) => c.id === anchored)?.anchor.frame).toBe(6);
    p.undo();
    const copy = p.production.duplicatePanel(a.id);
    expect(p.toJSON().comments.find((c) => c.id === anchored)?.anchor.frame).toBe(54);
    expect(p.toJSON().comments.find((c) => c.id === timed)?.anchor.frame).toBe(48);
    expect(p.toJSON().comments).toHaveLength(3);
    p.production.deletePanel(copy);
    expect(p.toJSON().comments).toEqual(original);
    p.production.deletePanel(b.id);
    expect(p.toJSON().comments).toHaveLength(0);
    p.undo();
    expect(p.toJSON().comments).toEqual(original);
  });
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
});
