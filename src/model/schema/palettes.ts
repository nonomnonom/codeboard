import { z } from "zod";
import { color } from "./primitives.js";

const id = z.string().min(1).max(4096);
export const colorChannelSchema = z.enum(["color", "fill", "stroke"]);
export const colorBindingSchema = z
  .object({ swatchId: id, override: color.max(4096).optional() })
  .strict();
export const colorBindingsSchema = z
  .object({
    color: colorBindingSchema.optional(),
    fill: colorBindingSchema.optional(),
    stroke: colorBindingSchema.optional(),
  })
  .strict();
export const paletteSchema = z
  .object({
    id,
    name: z.string().min(1).max(4096),
    swatches: z
      .array(z.object({ id, name: z.string().min(1).max(4096), color: color.max(4096) }).strict())
      .max(1000),
  })
  .strict()
  .refine((value) => Buffer.byteLength(JSON.stringify(value)) <= 1048576, "Palette exceeds 1 MiB");
