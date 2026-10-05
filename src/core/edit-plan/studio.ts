import { z } from "zod";
import type { ShotAnimation } from "../../model/types/shot.js";
import { defineShotAnimation } from "../../animation/shot.js";
import { CodeboardError } from "../../model/errors.js";
import { fingerprint } from "./fingerprint.js";
import { encodePlanLayer, decodePlanLayer, type PlanStudioLayer } from "./layers.js";
export type { PlanStudioLayer } from "./layers.js";

export type PlanShotAnimation = Omit<ShotAnimation, "layers"> & { layers: PlanStudioLayer[] };

export function planShotAnimation(input: ShotAnimation): PlanShotAnimation {
  fingerprint(input);
  const animation = defineShotAnimation(input);
  return { ...animation, layers: animation.layers.map(encodePlanLayer) };
}

export function readPlanShotAnimation(input: unknown): ShotAnimation {
  fingerprint(input);
  if (!input || typeof input !== "object" || !("layers" in input) || !Array.isArray(input.layers))
    throw new CodeboardError("INVALID_ARGUMENT", "Planned animation requires layers");
  return defineShotAnimation({ ...input, layers: input.layers.map(decodePlanLayer) });
}

export const planShotAnimationSchema = z
  .unknown()
  .transform((input, ctx): PlanShotAnimation | typeof z.NEVER => {
    try {
      return planShotAnimation(readPlanShotAnimation(input));
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : String(error),
      });
      return z.NEVER;
    }
  });
