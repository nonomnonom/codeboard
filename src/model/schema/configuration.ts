import { z } from "zod";
import { finite, color } from "./primitives.js";

export const projectSettingsSchema = z.object({
  title: z.string().min(1),
  author: z.string().optional(),
  canvas: z.object({
    width: finite.int().min(1).max(8192),
    height: finite.int().min(1).max(8192),
    background: color,
  }),
  seed: z.number().int(),
  frameRate: finite.positive(),
});

export const projectChangesSchema = projectSettingsSchema
  .pick({ title: true, seed: true })
  .partial()
  .extend({
    author: z.string().nullable().optional(),
    frameRate: z
      .object({ value: finite.positive(), timing: z.enum(["preserve-frames", "preserve-seconds"]) })
      .strict()
      .optional(),
    canvas: projectSettingsSchema.shape.canvas
      .partial()
      .extend({
        applyTo: z.enum(["new-panels", "all-panels"]).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
