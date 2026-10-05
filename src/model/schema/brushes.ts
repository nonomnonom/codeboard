import { z } from "zod";
import { finite } from "./primitives.js";

export const brush = z.object({
  provenance: z
    .object({
      source: z.string(),
      author: z.string().optional(),
      license: z.string(),
      redistribution: z.enum(["allowed", "unknown", "forbidden"]),
      resourceChecksum: z.string(),
    })
    .optional(),
  paperTexture: z
    .object({
      width: z.number().int().min(1).max(512),
      height: z.number().int().min(1).max(512),
      alpha: z.array(finite.min(0).max(1)).max(262144),
      scale: finite.positive(),
      strength: finite.min(0).max(1),
    })
    .optional(),
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.number().int().positive(),
  tip: z.discriminatedUnion("kind", [
    z.object({
      kind: z.enum(["round", "ellipse", "chisel", "rake"]),
      aspect: finite.min(0.05).max(1),
      angle: finite,
      rotationMode: z.enum(["fixed", "stroke", "stylus"]),
    }),
    z.object({
      kind: z.literal("bitmap"),
      width: z.number().int().min(1).max(512),
      height: z.number().int().min(1).max(512),
      alpha: z.array(finite.min(0).max(1)).max(262144),
      angle: finite,
      rotationMode: z.enum(["fixed", "stroke", "stylus"]),
      sourceAssetId: z.string().optional(),
    }),
  ]),
  size: finite.positive(),
  opacity: finite.min(0).max(1),
  flow: finite.min(0).max(1),
  hardness: finite.min(0.01).max(1),
  spacing: finite.min(0.02).max(4),
  taperStart: finite.min(0).max(1),
  taperEnd: finite.min(0).max(1),
  texture: z.enum(["none", "graphite", "charcoal", "dry-brush"]),
  textureStrength: finite.min(0).max(1),
  dynamics: z.object({
    pressureSize: finite.min(0).max(1),
    pressureOpacity: finite.min(0).max(1),
    speedSize: finite.min(-1).max(1),
    speedOpacity: finite.min(-1).max(1),
    tiltShape: finite.min(0).max(1),
    pressureSpacing: finite.min(-1).max(1),
    pressureHardness: finite.min(-1).max(1),
    rotationJitter: finite.min(0).max(1),
  }),
});

export const brushParameterSchema = z.toJSONSchema(brush);
