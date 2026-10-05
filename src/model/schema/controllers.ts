import { z } from "zod";
import { easingSchema } from "./animation.js";
const values = z
  .object({
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
    scaleX: z.number().finite().optional(),
    scaleY: z.number().finite().optional(),
    rotation: z.number().finite().optional(),
    opacity: z.number().finite().optional(),
    depth: z.number().finite().optional(),
  })
  .strict()
  .refine(
    (value) => Object.values(value).some((entry) => entry !== undefined),
    "Controller target needs channels",
  );
const id = z.string().min(1).max(4096);
const weight = z.number().min(0).max(1);
const frame = z.number().int().safe();
export const controllerRangeSchema = z
  .object({ startFrame: frame, endFrame: frame })
  .strict()
  .refine((range) => range.endFrame > range.startFrame, "Controller range must be nonempty");
const controllerKey = z.object({ frame, weight, easing: easingSchema }).strict();
export const shotControllerSchema = z
  .object({
    id: z.string().min(1).max(4096),
    name: z.string().min(1).max(4096),
    mode: z.enum(["replace", "additive"]),
    weight: z.number().min(0).max(1),
    targets: z
      .array(z.object({ layerId: z.string().min(1).max(4096), values }).strict())
      .min(1)
      .max(256),
    activeRange: controllerRangeSchema.optional(),
    keyframes: z.array(controllerKey).max(4096),
  })
  .strict();

export const shotControllerEdits = [
  z.object({ op: z.literal("controller.put"), controller: shotControllerSchema }).strict(),
  z.object({ op: z.literal("controller.remove"), id }).strict(),
  z
    .object({ op: z.literal("controller.range"), id, range: controllerRangeSchema.nullable() })
    .strict(),
  z.object({ op: z.literal("controller.weight"), id, weight }).strict(),
  z.object({ op: z.literal("controller.key.put"), id, key: controllerKey }).strict(),
  z.object({ op: z.literal("controller.key.remove"), id, frame }).strict(),
  z.object({ op: z.literal("controller.move"), id, beforeId: id.nullable() }).strict(),
] as const;
