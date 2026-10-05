import { studioAudioSchema } from "./studio-audio.js";
import { z } from "zod";
import { transitionSchema, rationalRateSchema as rate } from "./animation.js";

export { shotAnimationSchema, shotAnimationEditsSchema } from "./shot.js";

const id = z.string().min(1).max(4096);
const frame = z.number().int().nonnegative().safe();
export const editorialSequenceSchema = z
  .object({
    audio: studioAudioSchema.optional(),
    id,
    frameRate: rate,
    clips: z
      .array(
        z
          .object({
            id,
            animationId: id,
            startFrame: frame,
            sourceInFrame: frame,
            holdFrames: frame.optional(),
            durationFrames: frame.positive(),
            transition: transitionSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

const clip = editorialSequenceSchema.shape.clips.element;
export const editorialEditsSchema = z
  .array(
    z.discriminatedUnion("op", [
      z.object({ op: z.literal("split"), id, atFrame: frame.positive(), newId: id }).strict(),
      z
        .object({
          op: z.literal("insert"),
          clip: clip.omit({ startFrame: true }),
          beforeId: id.optional(),
        })
        .strict(),
      z
        .object({
          op: z.literal("update"),
          id,
          changes: clip
            .pick({
              animationId: true,
              sourceInFrame: true,
              holdFrames: true,
              durationFrames: true,
              transition: true,
            })
            .partial()
            .strict(),
        })
        .strict(),
      z.object({ op: z.literal("move"), id, beforeId: id.optional() }).strict(),
      z.object({ op: z.literal("remove"), id }).strict(),
    ]),
  )
  .min(1)
  .max(1000);
