import type { Layer, StoryboardDocument } from "../model/types.js";
import { createTimeMapper } from "./rational-time.js";
import { CodeboardError } from "../model/errors.js";
import { scene3DKeyCollections } from "./scene3d.js";

/** Operates on a staged document; the caller validates and commits it atomically. */
export function convertTimebase(document: StoryboardDocument, frameRate: number): void {
  const convert = createTimeMapper(document.frameRate, frameRate);
  const safe = (value: number) => {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error("Frame-rate conversion exceeds the safe integer frame range");
    return value;
  };
  const map = (frame: number) => safe(convert(safe(frame)).value);
  const interval = (start: number, end: number, owner: string) => {
    const result = { startFrame: map(start), endFrame: map(end) };
    if (result.endFrame <= result.startFrame)
      throw new Error(`Frame-rate conversion collapses ${owner}`);
    return result;
  };
  const keys = (
    entries: { frame: number }[],
    owner: string,
    collection: "keyframes" | "drawingSequence" = "keyframes",
  ) => {
    const positions = new Map<number, number>();
    for (const key of entries) {
      const frame = map(key.frame);
      if (positions.has(frame))
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          `Frame-rate conversion collapses keyframes in ${owner}`,
          {
            details: {
              reason: "FRAME_COLLISION",
              operation: "timebase-conversion",
              ownerId: owner,
              collection,
              targetFrame: frame,
              sourceFrames: [positions.get(frame)!, key.frame],
            },
          },
        );
      positions.set(frame, key.frame);
      key.frame = frame;
    }
  };
  const layers = (entries: Layer[]) => {
    for (const layer of entries) {
      keys(layer.keyframes, layer.id);
      if (layer.exposure)
        layer.exposure = interval(
          layer.exposure.startFrame,
          layer.exposure.endFrame,
          `exposure ${layer.id}`,
        );
      if (layer.kind === "group") {
        if (layer.drawingSequence) keys(layer.drawingSequence, layer.id, "drawingSequence");
        layers(layer.children);
      } else
        for (const element of layer.elements) {
          if (element.kind === "scene-3d")
            for (const entries of scene3DKeyCollections(element.scene)) keys(entries, element.id);
          if (element.kind === "raster-stroke" && element.reveal)
            element.reveal = interval(
              element.reveal.startFrame,
              element.reveal.endFrame,
              `stroke reveal ${element.id}`,
            );
        }
    }
  };
  for (const panel of document.panels) {
    const end = safe(panel.startFrame + panel.durationFrames);
    const bounds = interval(panel.startFrame, end, `panel ${panel.id}`);
    const transition = map(end) - map(end - panel.transition.durationFrames);
    if (panel.transition.durationFrames > 0 && transition === 0)
      throw new Error(`Frame-rate conversion collapses transition ${panel.id}`);
    panel.startFrame = bounds.startFrame;
    panel.durationFrames = bounds.endFrame - bounds.startFrame;
    panel.transition.durationFrames = transition;
    layers(panel.layers);
  }
  for (const component of document.components) layers(component.layers);
  for (const shot of document.shots) keys(shot.cameraKeyframes, shot.id);
  for (const track of document.audioTracks) {
    for (const clip of track.clips) {
      const start = clip.startFrame,
        end = safe(start + clip.durationFrames);
      const bounds = interval(start, end, `audio clip ${clip.id}`);
      clip.fadeInFrames = map(safe(start + clip.fadeInFrames)) - bounds.startFrame;
      clip.fadeOutFrames = bounds.endFrame - map(end - clip.fadeOutFrames);
      clip.sourceInFrame = map(clip.sourceInFrame);
      clip.startFrame = bounds.startFrame;
      clip.durationFrames = bounds.endFrame - bounds.startFrame;
      safe(clip.sourceInFrame + clip.durationFrames);
    }
  }
  for (const comment of document.comments)
    if (comment.anchor.frame !== undefined) comment.anchor.frame = map(comment.anchor.frame);
  document.frameRate = frameRate;
}
