import { z } from "zod";
import type { AudioMixOptions } from "./mix.js";
import { audioTrackSelectionSchema } from "./selection.js";
import { CodeboardError } from "../model/errors.js";

export const audioMixOptionsSchema = z
  .object({
    range: z
      .object({
        startSample: z.number().int().nonnegative().safe(),
        endSample: z.number().int().positive().safe(),
      })
      .strict()
      .optional(),
    tracks: audioTrackSelectionSchema.optional(),
    rounding: z.enum(["nearest", "exact"]).default("nearest"),
    sampleRate: z.number().int().min(8000).max(192000).default(48000),
    maxSamples: z.number().int().positive().max(16777216).default(16777216),
    signal: z.instanceof(AbortSignal).optional(),
  })
  .strict();
export function parseAudioMixOptions(input: AudioMixOptions) {
  const result = audioMixOptionsSchema.safeParse(input);
  if (!result.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid audio mix options", {
      details: { issues: result.error.issues },
    });
  return result.data;
}
