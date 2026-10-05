import { copyComponentOrigins } from "../../model/component-origins.js";
import type { StoryboardDocument } from "../../model/types.js";
import { allLayers, cloneLayersWithIdentities, findPanel } from "../../model/layers.js";
import { defineShotAnimation } from "../../animation/shot.js";
import { normalizeRate } from "../../animation/rational-time.js";
import { CodeboardError } from "../../model/errors.js";

export interface PanelCaptureResult {
  animationId: string;
  source: {
    projectId: string;
    version: number;
    panelId: string;
    panelRevision: number;
    startFrame: number;
    durationFrames: number;
    captureStartFrame: number;
    captureDurationFrames: number;
  };
  identities: { sourceId: string; capturedId: string }[];
}

export interface PanelCaptureOptions {
  id: string;
  name?: string;
  preRollFrames?: number;
  postRollFrames?: number;
}

export function capturePanelAnimation(
  document: StoryboardDocument,
  nextId: (prefix: string) => string,
  panelId: string,
  options: PanelCaptureOptions,
): PanelCaptureResult {
  if (document.studio.animations.some((animation) => animation.id === options.id))
    throw new CodeboardError("INVALID_ARGUMENT", "Capture requires a new animation ID");
  const panel = findPanel(document, panelId),
    shot = document.shots.find((shot) => shot.id === panel.shotId)!;
  const preRoll = options.preRollFrames === undefined ? 0 : options.preRollFrames,
    postRoll = options.postRollFrames === undefined ? 0 : options.postRollFrames;
  if (![preRoll, postRoll].every((value) => Number.isSafeInteger(value) && value >= 0))
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Capture handles must be nonnegative safe frame counts",
    );
  const captureStartFrame = panel.startFrame - preRoll;
  const captureDurationFrames = panel.durationFrames + preRoll + postRoll;
  if (
    ![captureStartFrame, captureDurationFrames, captureStartFrame + captureDurationFrames].every(
      Number.isSafeInteger,
    )
  )
    throw new CodeboardError("RESOURCE_LIMIT", "Capture range exceeds the safe frame range");
  const copied = cloneLayersWithIdentities(panel.layers, nextId);
  const layers = copied.layers;
  const identities: PanelCaptureResult["identities"] = copied.identities.map(
    ({ sourceId, copyId }) => ({ sourceId, capturedId: copyId }),
  );
  const record = (sourceId: string, capturedId: string) =>
    identities.push({ sourceId, capturedId });
  const local = (frame: number) => {
    const value = frame - captureStartFrame;
    if (!Number.isSafeInteger(frame) || !Number.isSafeInteger(value))
      throw new CodeboardError("RESOURCE_LIMIT", "Captured time exceeds the safe integer range");
    return value;
  };
  for (const layer of allLayers(layers)) {
    for (const key of layer.keyframes) key.frame = local(key.frame);
    if (layer.exposure)
      layer.exposure = {
        startFrame: local(layer.exposure.startFrame),
        endFrame: local(layer.exposure.endFrame),
      };
    if (layer.kind === "group")
      for (const key of layer.drawingSequence ?? []) key.frame = local(key.frame);
    else
      for (const element of layer.elements) {
        if (element.kind === "raster-stroke" && element.reveal)
          element.reveal = {
            startFrame: local(element.reveal.startFrame),
            endFrame: local(element.reveal.endFrame),
          };
      }
  }
  const cameraKeyframes = shot.cameraKeyframes.map((key) => {
    const id = nextId("camera-key");
    record(key.id, id);
    return { ...structuredClone(key), id, frame: local(key.frame) };
  });
  const animation = defineShotAnimation({
    id: options.id,
    shotId: shot.id,
    boardPanelIds: [panel.id],
    name: options.name ?? panel.title,
    frameRate: normalizeRate(document.frameRate),
    durationFrames: captureDurationFrames,
    canvas: { width: panel.width, height: panel.height, background: document.canvas.background },
    layers,
    cameraKeyframes,
  });
  document.studio.animations.push(animation);
  copyComponentOrigins(document, copied, nextId);
  return {
    animationId: animation.id,
    source: {
      projectId: document.id,
      version: document.version,
      panelId,
      panelRevision: panel.revision,
      startFrame: panel.startFrame,
      durationFrames: panel.durationFrames,
      captureStartFrame,
      captureDurationFrames,
    },
    identities,
  };
}
