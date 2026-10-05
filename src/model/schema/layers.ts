import { layerEffectsSchema } from "./layer-effects.js";
import { z } from "zod";
import { finite, transform } from "./primitives.js";
import { element, localDrawingElementSchema } from "./artwork.js";
import {
  exposureSchema,
  layerKeyframeSchema,
  drawingSequenceSchema,
  twoBoneRigSchema,
  localLayerKeyframeSchema,
  localExposureSchema,
  localDrawingSequenceSchema,
} from "./animation.js";

export const layerBase = {
  effects: layerEffectsSchema.optional(),
  pivot: z.object({ x: finite, y: finite }).strict().optional(),
  componentSource: z.object({ id: z.string(), version: z.number().int().positive() }).optional(),
  depth: finite.positive(),
  exposure: exposureSchema,
  id: z.string().min(1),
  name: z.string(),
  visible: z.boolean(),
  opacity: finite.min(0).max(1),
  blendMode: z.enum(["source-over", "multiply", "screen", "overlay", "darken", "lighten"]),
  transform,
  maskLayerId: z.string().optional(),
  clipToBelow: z.boolean(),
  keyframes: z.array(layerKeyframeSchema),
};

export const layerChangesSchema = z
  .object(layerBase)
  .pick({
    name: true,
    effects: true,
    visible: true,
    opacity: true,
    blendMode: true,
    transform: true,
    clipToBelow: true,
    pivot: true,
  })
  .partial()
  .extend({ maskLayerId: z.string().nullable().optional() })
  .strict();

export const layerOptionsSchema = z
  .object(layerBase)
  .pick({
    id: true,
    effects: true,
    pivot: true,
    depth: true,
    opacity: true,
    blendMode: true,
    maskLayerId: true,
    clipToBelow: true,
    visible: true,
  })
  .partial()
  .extend({
    transform: transform.partial().strict().optional(),
    exposure: exposureSchema.unwrap().optional(),
  })
  .strict();

export const layer: z.ZodTypeAny = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ ...layerBase, kind: z.enum(["raster", "vector"]), elements: z.array(element) }),
    z.object({
      ...layerBase,
      kind: z.literal("group"),
      children: z.array(layer),
      drawingSequence: drawingSequenceSchema.optional(),
      twoBoneRig: twoBoneRigSchema.optional(),
    }),
  ]),
);

const localLayerBase = {
  ...layerBase,
  keyframes: z.array(localLayerKeyframeSchema),
  exposure: localExposureSchema,
};
export const localLayer: z.ZodTypeAny = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({
      ...localLayerBase,
      kind: z.enum(["raster", "vector"]),
      elements: z.array(localDrawingElementSchema),
    }),
    z.object({
      ...localLayerBase,
      kind: z.literal("group"),
      children: z.array(localLayer),
      drawingSequence: localDrawingSequenceSchema.optional(),
      twoBoneRig: twoBoneRigSchema.optional(),
    }),
  ]),
);
