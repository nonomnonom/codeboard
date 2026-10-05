import { z } from "zod";
import type { LayerChannel } from "../model/types/animation.js";
import type { ShotController } from "../model/types/controllers.js";
import type { ShotAnimation } from "../model/types/shot.js";
import { allLayers } from "../model/layers.js";
import { CodeboardError } from "../model/errors.js";
import { defineShotAnimation } from "./shot.js";
import { reviseShotAnimation } from "./shot-edit.js";
import { evaluateLayer } from "./evaluate.js";
import { createControlledLayerEvaluator } from "./controllers.js";

export type ControllerCaptureOptions = {
  id: string;
  name: string;
  frame: number;
  evaluation: "base" | "controlled";
  targets: readonly { layerId: string; channels: readonly LayerChannel[] }[];
} & ({ mode: "replace" } | { mode: "additive"; referenceFrame: number });
const id = z.string().min(1).max(4096);
const frame = z.number().int().safe();
const common = {
  id,
  name: id,
  frame,
  evaluation: z.enum(["base", "controlled"]),
  targets: z
    .array(
      z
        .object({
          layerId: id,
          channels: z
            .array(z.enum(["x", "y", "scaleX", "scaleY", "rotation", "opacity", "depth"]))
            .min(1)
            .max(7),
        })
        .strict(),
    )
    .min(1)
    .max(256),
};
const schema = z.discriminatedUnion("mode", [
  z.object({ ...common, mode: z.literal("replace") }).strict(),
  z.object({ ...common, mode: z.literal("additive"), referenceFrame: frame }).strict(),
]);

/** Capture explicit local channels into an inactive controller without changing the source. */
export function captureShotController(
  input: ShotAnimation,
  options: ControllerCaptureOptions,
): ShotController {
  const parsed = schema.safeParse(options);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid controller pose capture", {
      details: { reason: "CONTROLLER_CAPTURE_INPUT", issues: parsed.error.issues },
    });
  const request = parsed.data;
  const animation = defineShotAnimation(input);
  if (animation.controllers?.some((controller) => controller.id === request.id))
    throw new CodeboardError("INVALID_ARGUMENT", "Capture requires a new controller ID");
  const layers = new Map(allLayers(animation.layers).map((layer) => [layer.id, layer]));
  const evaluate =
    request.evaluation === "base" ? evaluateLayer : createControlledLayerEvaluator(animation);
  const targets = new Set<string>();
  const controller: ShotController = {
    id: request.id,
    name: request.name,
    mode: request.mode,
    weight: 0,
    keyframes: [],
    targets: request.targets.map((target) => {
      const layer = layers.get(target.layerId);
      if (
        !layer ||
        targets.has(target.layerId) ||
        new Set(target.channels).size !== target.channels.length
      )
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Capture requires distinct existing layers and channels",
          {
            details: { reason: "CONTROLLER_CAPTURE_TARGET", layerId: target.layerId },
          },
        );
      targets.add(target.layerId);
      const pose = evaluate(layer, request.frame);
      const reference =
        request.mode === "additive" ? evaluate(layer, request.referenceFrame) : undefined;
      const values: Partial<Record<LayerChannel, number>> = {};
      for (const channel of target.channels) {
        const value =
          channel === "opacity" || channel === "depth" ? pose[channel] : pose.transform[channel];
        const base = reference
          ? channel === "opacity" || channel === "depth"
            ? reference[channel]
            : reference.transform[channel]
          : 0;
        const result = value - base;
        if (!Number.isFinite(result))
          throw new CodeboardError(
            "INVALID_ARGUMENT",
            "Captured pose offset exceeds numeric range",
            {
              details: { reason: "CONTROLLER_CAPTURE_RANGE", layerId: target.layerId, channel },
            },
          );
        values[channel] = result;
      }
      return { layerId: target.layerId, values };
    }),
  };
  reviseShotAnimation(animation, [{ op: "controller.put", controller }]);
  return controller;
}
