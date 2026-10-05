import { z } from "zod";
import { normalizeRate } from "../../animation/rational-time.js";

const id = z.string().min(1).max(4096),
  sample = z.number().int().nonnegative().safe();
export const studioAudioTrackSchema = z
  .object({
    id,
    name: z.string(),
    muted: z.boolean(),
    clips: z.array(
      z
        .object({
          id,
          assetId: id,
          name: z.string(),
          start: z
            .object({
              ticks: sample,
              rate: z
                .object({ numerator: sample.positive(), denominator: sample.positive() })
                .strict()
                .transform(normalizeRate),
            })
            .strict(),
          source: z
            .object({
              sampleRate: sample.positive(),
              startSample: sample,
              sampleCount: sample.positive(),
            })
            .strict(),
          volume: z.number().finite().nonnegative(),
          fadeInSamples: sample,
          fadeOutSamples: sample,
        })
        .strict()
        .superRefine((clip, ctx) => {
          if (!Number.isSafeInteger(clip.source.startSample + clip.source.sampleCount))
            ctx.addIssue({
              code: "custom",
              message: "Audio source end exceeds the safe sample range",
            });
          if (clip.fadeInSamples > clip.source.sampleCount - clip.fadeOutSamples)
            ctx.addIssue({
              code: "custom",
              message: "Audio fades overlap or exceed the source range",
            });
        }),
    ),
  })
  .strict();
export const studioAudioSchema = z.array(studioAudioTrackSchema).superRefine((tracks, ctx) => {
  const ids = new Set<string>();
  for (const track of tracks)
    for (const id of [track.id, ...track.clips.map((clip) => clip.id)]) {
      if (ids.has(id))
        ctx.addIssue({ code: "custom", message: `Duplicate studio audio ID: ${id}` });
      ids.add(id);
    }
});

const clip = studioAudioTrackSchema.shape.clips.element;
export const studioAudioEditsSchema = z
  .array(
    z.discriminatedUnion("op", [
      z.object({ op: z.literal("track.add"), track: studioAudioTrackSchema }).strict(),
      z
        .object({
          op: z.literal("track.update"),
          id,
          changes: studioAudioTrackSchema.pick({ name: true, muted: true }).partial().strict(),
        })
        .strict(),
      z.object({ op: z.literal("track.remove"), id }).strict(),
      z.object({ op: z.literal("clip.add"), trackId: id, clip }).strict(),
      z
        .object({
          op: z.literal("clip.update"),
          id,
          changes: z.object(clip.shape).omit({ id: true }).partial().strict(),
        })
        .strict(),
      z
        .object({ op: z.literal("clip.move"), id, trackId: id, start: clip.shape.start.optional() })
        .strict(),
      z
        .object({ op: z.literal("clip.split"), id, atSample: sample.positive(), newId: id })
        .strict(),
      z.object({ op: z.literal("clip.remove"), id }).strict(),
    ]),
  )
  .min(1)
  .max(1000);
