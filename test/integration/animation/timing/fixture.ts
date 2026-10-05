import { StoryboardProject } from "../../../../src/index.js";

export function fixture() {
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
