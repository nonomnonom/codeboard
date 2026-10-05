import { z } from "zod";
import { rationalRateSchema } from "./animation.js";

export const shotRetimeOptionsSchema = z
  .object({
    durationFrames: z.number().int().positive().safe(),
    frameRate: rationalRateSchema.optional(),
    rounding: z.enum(["exact", "nearest", "floor", "ceil"]).default("exact"),
    audio: z.enum(["preserve-seconds", "scale-starts"]),
  })
  .strict();
