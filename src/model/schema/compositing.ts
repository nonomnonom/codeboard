import { z } from "zod";
import { layerEffectsSchema } from "./layer-effects.js";
import { orderCompositeGraph } from "../validation/compositing.js";
import { easingSchema, effectValuesSchema } from "./animation.js";

const id = z.string().min(1).max(4096);
const frame = z.number().int().safe();
const effectKeys = z
  .array(
    z
      .object({
        frame,
        easing: easingSchema,
        effectValues: effectValuesSchema.refine(
          (values) => values.length > 0,
          "Effect key requires values",
        ),
      })
      .strict(),
  )
  .max(4096);
const blendKeys = z
  .array(
    z.object({ frame, easing: easingSchema, opacity: z.number().finite().min(0).max(1) }).strict(),
  )
  .max(4096);
export const shotCompositeGraphSchema = z
  .object({
    output: id,
    nodes: z
      .array(
        z.discriminatedUnion("kind", [
          z
            .object({
              id,
              kind: z.literal("source"),
              layerIds: z
                .array(id)
                .min(1)
                .max(256)
                .refine((ids) => new Set(ids).size === ids.length, "Duplicate source layer IDs"),
            })
            .strict(),
          z
            .object({
              id,
              kind: z.literal("effects"),
              input: id,
              effects: layerEffectsSchema,
              keyframes: effectKeys.optional(),
            })
            .strict(),
          z
            .object({
              id,
              kind: z.literal("blend"),
              background: id,
              foreground: id,
              mode: z.enum(["source-over", "multiply", "screen", "overlay", "darken", "lighten"]),
              opacity: z.number().finite().min(0).max(1),
              keyframes: blendKeys.optional(),
            })
            .strict(),
          z
            .object({
              id,
              kind: z.literal("mask"),
              input: id,
              mask: id,
              mode: z.enum(["in", "out"]),
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(32),
  })
  .strict()
  .transform((graph) => {
    const normalized = {
      ...graph,
      nodes: graph.nodes.map((node) => {
        if (node.kind === "effects") {
          const { keyframes, ...rest } = node;
          return { ...rest, ...(keyframes === undefined ? {} : { keyframes }) };
        }
        if (node.kind === "blend") {
          const { keyframes, ...rest } = node;
          return { ...rest, ...(keyframes === undefined ? {} : { keyframes }) };
        }
        return node;
      }),
    };
    orderCompositeGraph(normalized);
    return normalized;
  });
