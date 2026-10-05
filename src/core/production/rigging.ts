import { CodeboardError } from "../../model/errors.js";
import type { TwoBoneSolution } from "../../animation/ik.js";
import { validateTwoBoneRig } from "../../model/validation/rig.js";
import { prepareTwoBonePose, prepareTwoBonePoseKeys } from "../../animation/rig-pose.js";
import { assertRenderFrame } from "../../animation/frame.js";
import type { Id, TwoBoneRig, Easing } from "../../model/types.js";
import { twoBoneRigSchema } from "../../model/schema/animation.js";
import type { ProductionHost, MutationOptions } from "./host.js";
import { findLayer } from "../../model/layers.js";

type Host = Pick<ProductionHost, "_applyProduction" | "_readTwoBoneRig" | "actor">;

export function twoBoneRig(host: Host, rootId: Id) {
  return host._readTwoBoneRig(rootId);
}

export function setTwoBoneRig(
  host: Host,
  rootId: Id,
  definition: TwoBoneRig | null,
  options: MutationOptions = {},
): void {
  const parsed = definition === null ? null : twoBoneRigSchema.parse(definition);
  const rig: TwoBoneRig | null =
    parsed === null
      ? null
      : {
          elbowId: parsed.elbowId,
          upperLength: parsed.upperLength,
          lowerLength: parsed.lowerLength,
          ...(parsed.restPose === undefined ? {} : { restPose: parsed.restPose }),
        };
  host._applyProduction(
    "configure two-bone rig",
    [rootId],
    options.expectedVersion,
    (document) => {
      const { layer } = findLayer(document, rootId);
      if (layer.kind !== "group")
        throw new CodeboardError("INVALID_ARGUMENT", "Rig requires a group", {
          details: { reason: "RIG_ROOT_KIND", rootId },
        });
      if (rig) {
        validateTwoBoneRig(layer, rig);
        layer.twoBoneRig = rig;
      } else delete layer.twoBoneRig;
    },
    { layerId: rootId },
  );
}

export function poseTwoBoneRig(
  host: Host,
  rootId: Id,
  frame: number,
  target: { x: number; y: number },
  options: MutationOptions & {
    bend?: 1 | -1;
    easing?: Easing;
    unreachable?: "reject" | "clamp";
  } = {},
): TwoBoneSolution {
  assertRenderFrame(frame);
  let solution!: TwoBoneSolution;
  host._applyProduction(
    "pose two-bone rig",
    [rootId],
    options.expectedVersion,
    (document, next) => {
      const { layer } = findLayer(document, rootId);
      if (layer.kind !== "group" || !layer.twoBoneRig)
        throw new CodeboardError("INVALID_ARGUMENT", `No two-bone rig on ${rootId}`, {
          details: { reason: "RIG_MISSING", rootId },
        });
      const prepared = prepareTwoBonePose(layer, frame, target, options);
      const { elbow, rootKey, elbowKey } = prepared;
      const lock = document.locks.find(
        (lock) =>
          lock.targetType === "layer" && lock.targetId === elbow.id && lock.owner !== host.actor,
      );
      if (lock) throw new Error(`Locked by ${lock.owner}: ${lock.reason}`);
      solution = prepared.solution;
      const keys = prepareTwoBonePoseKeys(layer, prepared, {
        root: rootKey.id || next("layer-key"),
        elbow: elbowKey.id || next("layer-key"),
      });
      layer.keyframes = keys.root;
      elbow.keyframes = keys.elbow;
    },
    { layerId: rootId },
  );
  return solution;
}
