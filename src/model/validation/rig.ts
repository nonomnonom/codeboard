import { CodeboardError } from "../errors.js";
import type { GroupLayer, Layer, TwoBoneRig } from "../types.js";
import { solveTwoBoneIK } from "../../animation/ik.js";

/** Check only rigs whose joints are affected, without copying artwork payloads. */
export function validateRigLayerChange(layers: readonly Layer[], proposed: Layer): void {
  for (const layer of layers) {
    if (layer.kind !== "group") continue;
    const root = layer.id === proposed.id ? proposed : layer;
    if (
      root.kind === "group" &&
      root.twoBoneRig &&
      (root.id === proposed.id || root.twoBoneRig.elbowId === proposed.id)
    ) {
      validateTwoBoneRig(
        {
          ...root,
          children: root.children.map((child) => (child.id === proposed.id ? proposed : child)),
        },
        root.twoBoneRig,
      );
    }
    validateRigLayerChange(layer.children, proposed);
  }
}

export function validateTwoBoneRig(root: GroupLayer, rig: TwoBoneRig): GroupLayer {
  solveTwoBoneIK({ x: 0, y: 0 }, { x: 0, y: 0 }, rig.upperLength, rig.lowerLength);
  const elbow = root.children.find((child) => child.id === rig.elbowId);
  if (elbow?.kind !== "group")
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      `Rig elbow must be an immediate child group: ${rig.elbowId}`,
      {
        details: { reason: "RIG_ELBOW_PARENT", rootId: root.id, elbowId: rig.elbowId },
      },
    );
  if (root.drawingSequence !== undefined)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "A two-bone rig root cannot select drawing alternatives",
      {
        details: { reason: "RIG_DRAWING_SELECTION", rootId: root.id },
      },
    );
  for (const joint of [root, elbow]) {
    if (
      joint.transform.scaleX !== 1 ||
      joint.transform.scaleY !== 1 ||
      joint.pivot?.x ||
      joint.pivot?.y ||
      joint.keyframes.some(
        (key) => key.transform.scaleX !== undefined || key.transform.scaleY !== undefined,
      )
    )
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Two-bone joints require unit scale and origin pivots; scale an ancestor instead",
        { details: { reason: "RIG_JOINT_TRANSFORM", rootId: root.id, jointId: joint.id } },
      );
  }
  if (
    elbow.transform.x !== rig.upperLength ||
    elbow.transform.y !== 0 ||
    elbow.keyframes.some((key) => key.transform.x !== undefined || key.transform.y !== undefined)
  )
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Rig elbow must stay at (upperLength, 0) in root coordinates",
      {
        details: { reason: "RIG_ELBOW_OFFSET", rootId: root.id, elbowId: elbow.id },
      },
    );
  return elbow;
}
