import type { GroupLayer } from "../model/types.js";
import type { ShotAnimationEdit } from "../model/types/shot.js";
import { CodeboardError } from "../model/errors.js";
import { twoBoneRigSchema } from "../model/schema/animation.js";
import { validateTwoBoneRig } from "../model/validation/rig.js";
import { evaluateLayer } from "./evaluate.js";
import { prepareLayerPose } from "./layer-pose.js";

function joints(root: GroupLayer) {
  if (!root.twoBoneRig)
    throw new CodeboardError("INVALID_ARGUMENT", `No two-bone rig on ${root.id}`, {
      details: { reason: "RIG_MISSING", rootId: root.id },
    });
  return { rig: root.twoBoneRig, elbow: validateTwoBoneRig(root, root.twoBoneRig) };
}

export function captureTwoBoneRest(root: GroupLayer, frame: number) {
  if (!Number.isSafeInteger(frame))
    throw new CodeboardError("INVALID_ARGUMENT", "Rig frame must be a safe integer", {
      details: { reason: "RIG_FRAME", rootId: root.id },
    });
  const { elbow } = joints(root);
  const { x, y, rotation } = evaluateLayer(root, frame).transform;
  return twoBoneRigSchema.shape.restPose.unwrap().parse({
    root: { x, y, rotation },
    elbowRotation: evaluateLayer(elbow, frame).transform.rotation,
  });
}

/** Prepare both keys before publishing either joint's restored channels. */
export function prepareTwoBoneRest(
  root: GroupLayer,
  edit: Extract<ShotAnimationEdit, { op: "layer.rig.rest.apply" }>,
) {
  const { rig, elbow } = joints(root);
  if (!rig.restPose)
    throw new CodeboardError("INVALID_ARGUMENT", `No rest pose on ${root.id}`, {
      details: { reason: "RIG_REST_MISSING", rootId: root.id },
    });
  const rootKey = prepareLayerPose(root, {
    op: "layer.pose",
    layerId: root.id,
    frame: edit.frame,
    keyId: edit.rootKeyId,
    mode: "replace",
    weight: 1,
    values: rig.restPose.root,
    ...(edit.easing === undefined ? {} : { easing: edit.easing }),
  });
  const elbowKey = prepareLayerPose(elbow, {
    op: "layer.pose",
    layerId: elbow.id,
    frame: edit.frame,
    keyId: edit.elbowKeyId,
    mode: "replace",
    weight: 1,
    values: { rotation: rig.restPose.elbowRotation },
    ...(edit.easing === undefined ? {} : { easing: edit.easing }),
  });
  return { elbow, rootKey, elbowKey };
}
