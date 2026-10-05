import type { ShotAnimation } from "../model/types/shot.js";
import type { ShotRetimeOptions } from "../model/types/shot-timing.js";
import { shotRetimeOptionsSchema } from "../model/schema/shot-timing.js";
import { defineShotAnimation } from "./shot.js";
import { iterateLayers } from "../model/layers.js";
import {
  createTimeMapper,
  scaleTimeByDuration,
  type RationalRate,
  type TimeRounding,
} from "./rational-time.js";
import { CodeboardError } from "../model/errors.js";

export interface ShotRetimeReport {
  animationId: string;
  before: { durationFrames: number; frameRate: RationalRate };
  after: { durationFrames: number; frameRate: RationalRate };
  rounding: TimeRounding;
  positions: number;
  movedPositions: number;
  quantizedPositions: number;
  audio: { policy: ShotRetimeOptions["audio"]; clips: number; movedStarts: number };
}

/** Retime every shot-local frame collection on a detached snapshot; never stretch audio samples. */
export function retimeShotAnimation(
  input: ShotAnimation,
  options: ShotRetimeOptions,
): {
  animation: ShotAnimation;
  report: ShotRetimeReport;
} {
  const parsed = shotRetimeOptionsSchema.safeParse(options);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid shot retime options", {
      details: { issues: parsed.error.issues },
    });
  const settings = parsed.data;
  const animation = defineShotAnimation(input);
  const before = {
    durationFrames: animation.durationFrames,
    frameRate: { ...animation.frameRate },
  };
  const after = {
    durationFrames: settings.durationFrames,
    frameRate: settings.frameRate ?? { ...animation.frameRate },
  };
  const report: ShotRetimeReport = {
    animationId: animation.id,
    before,
    after,
    rounding: settings.rounding,
    positions: 0,
    movedPositions: 0,
    quantizedPositions: 0,
    audio: { policy: settings.audio, clips: 0, movedStarts: 0 },
  };
  const convert = createTimeMapper(before.durationFrames, after.durationFrames, settings.rounding);
  function map(frame: number, ownerId: string, collection: string) {
    try {
      const result = convert(frame);
      report.positions++;
      if (result.value !== frame) report.movedPositions++;
      if (!result.exact) report.quantizedPositions++;
      return result.value;
    } catch (cause) {
      if (cause instanceof CodeboardError)
        throw new CodeboardError(cause.code, cause.message, {
          details: {
            ...cause.details,
            animationId: animation.id,
            ownerId,
            collection,
            sourceFrame: frame,
          },
          cause,
        });
      throw cause;
    }
  }
  function keys(entries: readonly { frame: number }[], ownerId: string, collection: string) {
    const positions = new Map<number, number>();
    for (const key of entries) {
      const original = key.frame,
        frame = map(original, ownerId, collection);
      if (positions.has(frame))
        throw new CodeboardError("INVALID_ARGUMENT", "Shot retiming collapses distinct keys", {
          details: {
            reason: "FRAME_COLLISION",
            operation: "shot-retime",
            animationId: animation.id,
            ownerId,
            collection,
            targetFrame: frame,
            sourceFrames: [positions.get(frame)!, original],
          },
        });
      positions.set(frame, original);
      key.frame = frame;
    }
  }
  function interval(
    value: { startFrame: number; endFrame: number },
    ownerId: string,
    collection: string,
  ) {
    const startFrame = map(value.startFrame, ownerId, `${collection}.startFrame`);
    const endFrame = map(value.endFrame, ownerId, `${collection}.endFrame`);
    if (endFrame <= startFrame)
      throw new CodeboardError("INVALID_ARGUMENT", "Shot retiming collapses an interval", {
        details: {
          reason: "INTERVAL_COLLAPSE",
          animationId: animation.id,
          ownerId,
          collection,
          startFrame,
          endFrame,
        },
      });
    value.startFrame = startFrame;
    value.endFrame = endFrame;
  }
  keys(animation.cameraKeyframes, animation.id, "cameraKeyframes");
  for (const layer of iterateLayers(animation.layers)) {
    keys(layer.keyframes, layer.id, "keyframes");
    if (layer.exposure) interval(layer.exposure, layer.id, "exposure");
    if (layer.kind === "group") {
      if (layer.drawingSequence) keys(layer.drawingSequence, layer.id, "drawingSequence");
    } else
      for (const element of layer.elements)
        if (element.kind === "raster-stroke" && element.reveal)
          interval(element.reveal, element.id, "reveal");
  }
  for (const controller of animation.controllers ?? []) {
    keys(controller.keyframes, controller.id, "controller.keyframes");
    if (controller.activeRange)
      interval(controller.activeRange, controller.id, "controller.activeRange");
  }
  for (const binding of animation.meshes ?? []) {
    if (binding.mesh) keys(binding.mesh.keyframes, binding.layerId, "mesh.keyframes");
    if (binding.curve) keys(binding.curve.keyframes, binding.layerId, "curve.keyframes");
    if (binding.envelope) keys(binding.envelope.keyframes, binding.layerId, "envelope.keyframes");
  }
  for (const node of animation.compositing?.nodes ?? [])
    if (node.kind === "effects" || node.kind === "blend")
      keys(node.keyframes ?? [], node.id, "compositing.keyframes");
  for (const track of animation.audio ?? [])
    for (const clip of track.clips) {
      report.audio.clips++;
      if (settings.audio === "preserve-seconds") continue;
      const start = scaleTimeByDuration(
        clip.start,
        { ticks: before.durationFrames, rate: before.frameRate },
        { ticks: after.durationFrames, rate: after.frameRate },
      );
      if (
        start.ticks !== clip.start.ticks ||
        start.rate.numerator !== clip.start.rate.numerator ||
        start.rate.denominator !== clip.start.rate.denominator
      )
        report.audio.movedStarts++;
      clip.start = start;
    }
  animation.durationFrames = after.durationFrames;
  animation.frameRate = after.frameRate;
  return { animation: defineShotAnimation(animation), report };
}
