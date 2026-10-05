import { z } from "zod";
import { audioMixOptionsSchema } from "../audio/mix-options.js";
import { audioTrackSelectionSchema } from "../audio/selection.js";
import { CodeboardError } from "../model/errors.js";

const optionsSchema = z
  .object({
    stems: z
      .array(
        z.object({ name: z.string().min(1).max(256), tracks: audioTrackSelectionSchema }).strict(),
      )
      .min(1)
      .max(32),
    transitions: z.enum(["sum", "linear"]),
    sampleFormat: z.enum(["pcm16", "float32"]).default("float32"),
    mix: audioMixOptionsSchema.omit({ tracks: true }).prefault({}),
  })
  .strict();

export function parseAudioStemOptions(input: unknown) {
  const parsed = optionsSchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid audio stem options", {
      details: { issues: parsed.error.issues },
    });
  return parsed.data;
}
