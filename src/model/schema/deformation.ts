import { z } from "zod";
import { easingSchema } from "./animation.js";
import { elementMatrix } from "./primitives.js";

const vertex = z.object({ x: z.number().finite(), y: z.number().finite() }).strict();
const index = z.number().int().nonnegative().safe();
const jointId = z.string().min(1).max(4096);
export const skinInfluencesSchema = z
  .array(z.object({ jointId, weight: z.number().finite().positive().max(1) }).strict())
  .min(1)
  .max(8);
export const skinMeshSchema = z
  .object({
    source: z.array(vertex).min(3).max(12288),
    triangles: z
      .array(z.tuple([index, index, index]))
      .min(1)
      .max(4096),
    joints: z
      .array(z.object({ id: jointId, bind: elementMatrix }).strict())
      .min(1)
      .max(256),
    weights: z.array(skinInfluencesSchema).max(12288),
  })
  .strict();
export const layerSkinSchema = skinMeshSchema.extend({
  jointLayers: z
    .array(z.object({ jointId, layerId: jointId }).strict())
    .min(1)
    .max(256),
});
export const skinJointPosesSchema = z
  .array(z.object({ jointId, matrix: elementMatrix }).strict())
  .max(256);
const boundary = z.tuple([vertex, vertex, vertex, vertex]);
const envelopePose = z
  .object({ top: boundary, bottom: boundary, left: boundary, right: boundary })
  .strict();
export const envelopeKeyframeSchema = z
  .object({ frame: z.number().int().safe(), pose: envelopePose, easing: easingSchema })
  .strict();
export const envelopeMeshSchema = z
  .object({
    rest: envelopePose,
    columns: z.number().int().min(1).max(2048).default(8),
    rows: z.number().int().min(1).max(2048).default(8),
    keyframes: z.array(envelopeKeyframeSchema).max(4096),
  })
  .strict();
const curvePose = z
  .object({
    curve: boundary,
    width: z.number().finite().positive(),
  })
  .strict();
export const curveKeyframeSchema = curvePose.extend({
  frame: z.number().int().safe(),
  easing: easingSchema,
});
export const curveMeshSchema = z
  .object({
    rest: curvePose,
    segments: z.number().int().min(1).max(2048).default(32),
    keyframes: z.array(curveKeyframeSchema).max(4096),
  })
  .strict();
export const meshKeyframeSchema = z
  .object({
    frame: z.number().int().safe(),
    vertices: z.array(vertex).max(12288),
    easing: easingSchema,
  })
  .strict();
const shape = z
  .object({
    source: z.array(vertex).max(12288),
    triangles: z.array(z.tuple([index, index, index])).max(4096),
    keyframes: z.array(meshKeyframeSchema).max(4096),
  })
  .strict();

/** Bound the raw vertex payload before the detailed schema copies its nested values. */
export const meshAnimationSchema = z.preprocess((input, context) => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
  if ("triangles" in input && Array.isArray(input.triangles) && input.triangles.length > 4096) {
    context.addIssue({ code: "custom", message: "Mesh animation exceeds 4096 triangles" });
    return z.NEVER;
  }
  if (!("source" in input) || !("keyframes" in input)) return input;
  if (!Array.isArray(input.source) || !Array.isArray(input.keyframes)) return input;
  if (input.source.length > 12288 || input.keyframes.length > 4096) {
    context.addIssue({ code: "custom", message: "Mesh animation exceeds geometry limits" });
    return z.NEVER;
  }
  let vertices = input.source.length;
  for (const key of input.keyframes) {
    if (typeof key === "object" && key !== null && "vertices" in key && Array.isArray(key.vertices))
      vertices += key.vertices.length;
    if (vertices > 262144) {
      context.addIssue({
        code: "custom",
        message: "Mesh animation exceeds 262144 stored vertices",
      });
      return z.NEVER;
    }
  }
  return input;
}, shape);
