import { z } from "zod";
import { shotCompositeGraphSchema } from "./compositing.js";

export const shotRenderOptionsSchema = z
  .object({
    compositing: shotCompositeGraphSchema.nullable().optional(),
    layerIds: z
      .array(z.string().min(1).max(4096))
      .min(1)
      .max(256)
      .refine((ids) => new Set(ids).size === ids.length, "Render layer IDs must be unique")
      .optional(),
    background: z.enum(["scene", "transparent"]).optional(),
  })
  .strict()
  .refine(
    (options) => !(options.layerIds && options.compositing),
    "Choose layerIds or compositing, not both",
  )
  .transform(({ layerIds, background, compositing }) => ({
    ...(compositing === undefined ? {} : { compositing }),
    ...(layerIds === undefined ? {} : { layerIds }),
    ...(background === undefined ? {} : { background }),
  }));
