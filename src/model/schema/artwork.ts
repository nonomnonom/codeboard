import { z } from "zod";
import { validatePixels } from "../validation/pixels.js";
import { isVectorFill } from "../../drawing/gradient-fill.js";
import type { VectorFill } from "../types.js";
import { elementMatrix, point, color, finite } from "./primitives.js";
import { brush } from "./brushes.js";
import { colorBindingsSchema } from "./palettes.js";

export const rasterStroke = z.object({
  colorBindings: colorBindingsSchema.optional(),
  matrix: elementMatrix.optional(),
  reveal: z
    .object({
      startFrame: z.number().int().nonnegative(),
      endFrame: z.number().int().nonnegative(),
    })
    .refine((r) => r.endFrame > r.startFrame, "Reveal end must follow start")
    .optional(),
  kind: z.literal("raster-stroke"),
  id: z.string(),
  name: z.string().optional(),
  points: z.array(point).min(1),
  brush,
  color,
  opacity: finite.min(0).max(1),
  erase: z.boolean(),
  seed: z.number().int(),
  visible: z.boolean(),
});

export const vectorStroke = z.object({
  colorBindings: colorBindingsSchema.optional(),
  matrix: elementMatrix.optional(),
  kind: z.literal("vector-stroke"),
  id: z.string(),
  name: z.string().optional(),
  points: z.array(point).min(1),
  color,
  width: finite.positive(),
  opacity: finite.min(0).max(1),
  taperStart: finite.min(0).max(1),
  taperEnd: finite.min(0).max(1),
  pressureSize: finite.min(0).max(1),
  closed: z.boolean(),
  fill: color.optional(),
  visible: z.boolean(),
});

export const pathCommand = z.discriminatedUnion("op", [
  z.object({ op: z.literal("M"), x: finite, y: finite }),
  z.object({ op: z.literal("L"), x: finite, y: finite }),
  z.object({
    op: z.literal("C"),
    x1: finite,
    y1: finite,
    x2: finite,
    y2: finite,
    x: finite,
    y: finite,
  }),
  z.object({ op: z.literal("Q"), x1: finite, y1: finite, x: finite, y: finite }),
  z.object({ op: z.literal("Z") }),
]);

export const vectorPath = z.object({
  colorBindings: colorBindingsSchema.optional(),
  matrix: elementMatrix.optional(),
  kind: z.literal("vector-path"),
  id: z.string(),
  name: z.string().optional(),
  commands: z.array(pathCommand),
  fill: z
    .custom<VectorFill>(
      isVectorFill,
      "Invalid drawing color or vector fill: check gradient coordinates and ordered color stops",
    )
    .transform((value) => structuredClone(value))
    .optional(),
  stroke: color.optional(),
  strokeWidth: finite.nonnegative(),
  opacity: finite.min(0).max(1),
  visible: z.boolean(),
});

export const textElement = z.object({
  colorBindings: colorBindingsSchema.optional(),
  matrix: elementMatrix.optional(),
  kind: z.literal("text"),
  id: z.string(),
  name: z.string().optional(),
  x: finite,
  y: finite,
  text: z.string(),
  color,
  font: z.string(),
  align: z.enum(["left", "center", "right"]),
  opacity: finite.min(0).max(1),
  visible: z.boolean(),
});

export const rasterSurface = z
  .object({
    colorBindings: colorBindingsSchema.optional(),
    kind: z.literal("raster-surface"),
    id: z.string(),
    name: z.string().optional(),
    width: finite.int().positive(),
    height: finite.int().positive(),
    pixels: z.instanceof(Uint8Array).transform((bytes) => new Uint8Array(bytes)),
    matrix: elementMatrix,
    opacity: finite.min(0).max(1),
    visible: z.boolean(),
  })
  .superRefine((value, ctx) => {
    try {
      validatePixels(value);
    } catch (error) {
      ctx.addIssue({ code: "custom", message: (error as Error).message });
    }
  });

export const element = z.discriminatedUnion("kind", [
  rasterStroke,
  rasterSurface,
  vectorStroke,
  vectorPath,
  textElement,
]);

export const drawingElementSchema = element;

export const pathCommandSchema = pathCommand;

export const localDrawingElementSchema = z.discriminatedUnion("kind", [
  rasterStroke.extend({
    reveal: z
      .object({ startFrame: z.number().int().safe(), endFrame: z.number().int().safe() })
      .refine((r) => r.endFrame > r.startFrame, "Reveal end must follow start")
      .optional(),
  }),
  rasterSurface,
  vectorStroke,
  vectorPath,
  textElement,
]);
