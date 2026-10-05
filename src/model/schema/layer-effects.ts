import { z } from "zod";
import { finite } from "./primitives.js";

const effectAmount = finite.min(0).max(10);
export const layerEffectsSchema = z
  .array(
    z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("blur"), amount: finite.min(0).max(128) }).strict(),
      z
        .object({
          kind: z.literal("shadow"),
          amount: finite.min(0).max(128),
          offsetX: finite.min(-4096).max(4096),
          offsetY: finite.min(-4096).max(4096),
          color: z
            .object({
              r: z.number().int().min(0).max(255),
              g: z.number().int().min(0).max(255),
              b: z.number().int().min(0).max(255),
            })
            .strict(),
          opacity: finite.min(0).max(1),
        })
        .strict(),
      z.object({ kind: z.literal("brightness"), amount: effectAmount }).strict(),
      z.object({ kind: z.literal("contrast"), amount: effectAmount }).strict(),
      z.object({ kind: z.literal("saturation"), amount: effectAmount }).strict(),
      z.object({ kind: z.literal("hue-rotate"), degrees: finite.min(-360).max(360) }).strict(),
    ]),
  )
  .max(16);
