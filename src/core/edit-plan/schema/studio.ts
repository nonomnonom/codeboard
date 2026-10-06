import { shotAnimationEditsSchema } from "../../../model/schema/shot.js";
import { studioAudioSchema, studioAudioEditsSchema } from "../../../model/schema/studio-audio.js";
import { z } from "zod";
import { planShotElementSchema } from "../artwork.js";
import { planShotAnimationSchema } from "../studio.js";
import { editorialSequenceSchema, editorialEditsSchema } from "../../../model/schema/editorial.js";
import { id, pixelRegion } from "./common.js";
import { characterInstanceOptionsSchema } from "../../../model/schema/characters.js";

export const studioCommands = {
  "character.instantiate": characterInstanceOptionsSchema
    .extend({ op: z.literal("character.instantiate"), sourceAnimationId: id })
    .strict(),
  "animation.duplicate": z
    .object({
      op: z.literal("animation.duplicate"),
      sourceAnimationId: id,
      id,
      shotId: id,
      name: z.string().optional(),
    })
    .strict(),
  "animation.element.add": z
    .object({
      op: z.literal("animation.element.add"),
      animationId: id,
      layerId: id,
      element: planShotElementSchema,
    })
    .strict(),
  "animation.element.remove": z
    .object({
      op: z.literal("animation.element.remove"),
      animationId: id,
      layerId: id,
      ids: z.array(id).min(1),
    })
    .strict(),
  "animation.edit": z
    .object({ op: z.literal("animation.edit"), id, edits: shotAnimationEditsSchema })
    .strict(),
  "studio.audio.edit": z
    .object({ op: z.literal("studio.audio.edit"), ownerId: id, edits: studioAudioEditsSchema })
    .strict(),
  "studio.audio.set": z
    .object({ op: z.literal("studio.audio.set"), ownerId: id, tracks: studioAudioSchema })
    .strict(),
  "editorial.edit": z
    .object({ op: z.literal("editorial.edit"), id, edits: editorialEditsSchema })
    .strict(),
  "animation.capturePanel": z
    .object({
      op: z.literal("animation.capturePanel"),
      panelId: id,
      id,
      name: z.string().optional(),
      preRollFrames: z.number().int().nonnegative().safe().optional(),
      postRollFrames: z.number().int().nonnegative().safe().optional(),
    })
    .strict(),
  "animation.element.replace": z
    .object({
      op: z.literal("animation.element.replace"),
      animationId: id,
      layerId: id,
      id,
      element: planShotElementSchema,
    })
    .strict(),
  "animation.pixels.patch": z
    .object({
      op: z.literal("animation.pixels.patch"),
      animationId: id,
      layerId: id,
      id,
      region: pixelRegion,
      pixelsBase64: z.string(),
    })
    .strict(),
  "animation.put": z
    .object({ op: z.literal("animation.put"), animation: planShotAnimationSchema })
    .strict(),
  "animation.remove": z.object({ op: z.literal("animation.remove"), id }).strict(),
  "editorial.put": z
    .object({ op: z.literal("editorial.put"), sequence: editorialSequenceSchema })
    .strict(),
  "editorial.remove": z.object({ op: z.literal("editorial.remove"), id }).strict(),
};
