import type { Layer, LayerChannel } from "../model/types.js";
import type { ShotAnimationEdit } from "../model/types/shot.js";
import { localLayerKeyframeSchema } from "../model/schema/animation.js";
import { CodeboardError } from "../model/errors.js";
import { evaluateLayer } from "./evaluate.js";

type PoseEdit = Extract<ShotAnimationEdit, { op: "layer.pose" }>;

/** Bake a validated pose edit against the current draft's evaluated channels. */
export function prepareLayerPose(layer: Layer, edit: PoseEdit) {
  const existing = layer.keyframes.find((key) => key.frame === edit.frame);
  if (existing && existing.id !== edit.keyId)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Pose must retain the existing key ID at this frame",
      {
        details: {
          reason: "POSE_KEY_ID_MISMATCH",
          layerId: layer.id,
          frame: edit.frame,
          keyId: edit.keyId,
          existingKeyId: existing.id,
        },
      },
    );
  const conflict = layer.keyframes.find((key) => key.id === edit.keyId && key.frame !== edit.frame);
  if (conflict)
    throw new CodeboardError("INVALID_ARGUMENT", "Pose key ID belongs to another frame", {
      details: {
        reason: "POSE_KEY_ID_FRAME",
        layerId: layer.id,
        frame: edit.frame,
        keyId: edit.keyId,
        existingFrame: conflict.frame,
      },
    });
  const state = evaluateLayer(layer, edit.frame);
  const proposed = {
    ...existing,
    id: edit.keyId,
    frame: edit.frame,
    transform: { ...existing?.transform },
    easing: existing?.easing ?? edit.easing ?? "linear",
    channelEasing: { ...existing?.channelEasing },
  };
  for (const channel of Object.keys(edit.values) as LayerChannel[]) {
    const value = edit.values[channel];
    if (value === undefined) continue;
    const base =
      channel === "opacity" || channel === "depth" ? state[channel] : state.transform[channel];
    const blended =
      edit.weight === 0
        ? base
        : edit.mode === "additive"
          ? base + edit.weight * value
          : edit.weight === 1
            ? value
            : (1 - edit.weight) * base + edit.weight * value;
    if (channel === "opacity" || channel === "depth") proposed[channel] = blended;
    else proposed.transform[channel] = blended;
    if (edit.easing !== undefined) proposed.channelEasing[channel] = edit.easing;
  }
  const parsed = localLayerKeyframeSchema.safeParse(proposed);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Blended pose cannot form a valid keyframe", {
      details: {
        reason: "POSE_RESULT_INVALID",
        layerId: layer.id,
        frame: edit.frame,
        keyId: edit.keyId,
        mode: edit.mode,
        weight: edit.weight,
        issues: parsed.error.issues,
      },
      cause: parsed.error,
    });
  return parsed.data;
}
