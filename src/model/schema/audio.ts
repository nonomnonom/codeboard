import { z } from "zod";
import { finite } from "./primitives.js";

export const audioClipSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  name: z.string(),
  startFrame: z.number().int().nonnegative(),
  sourceInFrame: z.number().int().nonnegative(),
  durationFrames: z.number().int().positive(),
  volume: finite.min(0).max(2),
  fadeInFrames: z.number().int().nonnegative(),
  fadeOutFrames: z.number().int().nonnegative(),
});

export const audioTrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  muted: z.boolean(),
  locked: z.boolean(),
  clips: z.array(audioClipSchema),
});

export const audioTrackChangesSchema = audioTrackSchema
  .pick({ name: true, muted: true, locked: true })
  .partial()
  .strict();
