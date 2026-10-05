import type { GroupLayer, Layer, Easing } from "../model/types.js";
import { solveTwoBoneIK } from "./ik.js";
import { validateTwoBoneRig } from "../model/validation/rig.js";
import { evaluateLayer } from "./evaluate.js";
import { localLayerKeyframeSchema } from "../model/schema/animation.js";
import { CodeboardError } from "../model/errors.js";

/** Prepare sparse rotation keys without mutating either joint. Target uses the root parent's space. */
export function prepareTwoBonePose(
  root: GroupLayer,
  frame: number,
  target: { x: number; y: number },
  options: { bend?: 1 | -1; easing?: Easing; unreachable?: "reject" | "clamp" } = {},
) {
  if (options.unreachable !== undefined && !["reject", "clamp"].includes(options.unreachable))
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid unreachable rig target policy", {
      details: { reason: "RIG_REACH_POLICY", rootId: root.id },
    });
  if (!Number.isSafeInteger(frame))
    throw new CodeboardError("INVALID_ARGUMENT", "Rig frame must be a safe integer", {
      details: { reason: "RIG_FRAME", rootId: root.id },
    });
  if (!root.twoBoneRig)
    throw new CodeboardError("INVALID_ARGUMENT", `No two-bone rig on ${root.id}`, {
      details: { reason: "RIG_MISSING", rootId: root.id },
    });
  const elbow = validateTwoBoneRig(root, root.twoBoneRig);
  const rootState = evaluateLayer(root, frame).transform,
    elbowState = evaluateLayer(elbow, frame).transform;
  const solution = solveTwoBoneIK(
    rootState,
    target,
    root.twoBoneRig.upperLength,
    root.twoBoneRig.lowerLength,
    options.bend ?? 1,
  );
  if (!solution.reachable && options.unreachable === "reject")
    throw new CodeboardError("INVALID_ARGUMENT", "Rig target is outside the reachable range", {
      details: { reason: "RIG_UNREACHABLE", rootId: root.id, frame, solution },
    });
  const nearest = (angle: number, reference: number) =>
    reference + Math.atan2(Math.sin(angle - reference), Math.cos(angle - reference));
  const key = (joint: Layer, angle: number, reference: number) => {
    const existing = joint.keyframes.find((key) => key.frame === frame);
    return localLayerKeyframeSchema.parse({
      ...existing,
      id: existing?.id ?? "",
      frame,
      transform: { ...existing?.transform, rotation: nearest(angle, reference) },
      easing: existing?.easing ?? options.easing ?? "linear",
      channelEasing: { ...existing?.channelEasing, rotation: options.easing ?? "linear" },
    });
  };
  return {
    solution,
    elbow,
    rootKey: key(root, solution.rootRotation, rootState.rotation),
    elbowKey: key(elbow, solution.elbowRotation, elbowState.rotation),
  };
}

/** Prepare both joint key arrays before callers publish either one. */
export function prepareTwoBonePoseKeys(
  root: GroupLayer,
  pose: ReturnType<typeof prepareTwoBonePose>,
  ids: { root: string; elbow: string },
) {
  const keys = (joint: Layer, key: typeof pose.rootKey, id: string) => {
    if (key.id && key.id !== id)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Rig pose must retain the existing key ID at this frame",
      );
    if (joint.keyframes.some((existing) => existing.id === id && existing.frame !== key.frame))
      throw new CodeboardError("INVALID_ARGUMENT", "Rig pose key ID belongs to another frame");
    const result = joint.keyframes.slice();
    const index = result.findIndex((existing) => existing.id === id);
    // Other IDs at this frame must survive so final batch validation can reject the collision.
    if (index < 0) result.push({ ...key, id });
    else result[index] = { ...key, id };
    return result.sort((a, b) => a.frame - b.frame);
  };
  return {
    root: keys(root, pose.rootKey, ids.root),
    elbow: keys(pose.elbow, pose.elbowKey, ids.elbow),
  };
}
