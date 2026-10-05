import { z } from "zod";
import type { Layer } from "../../model/types.js";
import { defineComponentSource } from "../../model/component-source.js";
import { CodeboardError } from "../../model/errors.js";
import { fingerprint } from "./fingerprint.js";
import { encodePlanLayer, decodePlanLayer, type PlanStudioLayer } from "./layers.js";

export function planComponentSource(input: readonly Layer[]): PlanStudioLayer[] {
  fingerprint(input);
  return defineComponentSource(input).map(encodePlanLayer);
}

export function readPlanComponentSource(input: unknown): Layer[] {
  fingerprint(input);
  if (!Array.isArray(input))
    throw new CodeboardError("INVALID_ARGUMENT", "Planned component source requires a layer array");
  return defineComponentSource(input.map(decodePlanLayer));
}

export const planComponentSourceSchema = z.unknown().transform((input, ctx) => {
  try {
    return planComponentSource(readPlanComponentSource(input));
  } catch (error) {
    ctx.addIssue({
      code: "custom",
      message: error instanceof Error ? error.message : String(error),
    });
    return z.NEVER;
  }
});
