import { z } from "zod";
import { assetSchema } from "../../../model/schema/media.js";
import { audioClipSchema, audioTrackChangesSchema } from "../../../model/schema/audio.js";
import { id, hash, frame } from "./common.js";

export const mediaCommands = {
  "audio.track.add": z.object({ op: z.literal("audio.track.add"), id, name: z.string() }).strict(),
  "audio.track.update": z
    .object({ op: z.literal("audio.track.update"), id, changes: audioTrackChangesSchema })
    .strict(),
  "audio.track.remove": z.object({ op: z.literal("audio.track.remove"), id }).strict(),
  "audio.clip.add": z
    .object({
      op: z.literal("audio.clip.add"),
      trackId: id,
      clip: audioClipSchema.extend({ id: id.optional() }).strict(),
    })
    .strict(),
  "audio.clip.update": z
    .object({
      op: z.literal("audio.clip.update"),
      trackId: id,
      id,
      changes: audioClipSchema.omit({ id: true, assetId: true }).partial().strict(),
    })
    .strict(),
  "audio.clip.remove": z.object({ op: z.literal("audio.clip.remove"), trackId: id, id }).strict(),
  "audio.clip.move": z
    .object({ op: z.literal("audio.clip.move"), id, trackId: id, startFrame: frame.optional() })
    .strict(),
  "audio.clip.split": z.object({ op: z.literal("audio.clip.split"), id, frame }).strict(),
  "asset.add": z
    .object({
      op: z.literal("asset.add"),
      asset: assetSchema.extend({ id, checksum: hash }).strict(),
    })
    .strict(),
  "asset.update": z
    .object({
      op: z.literal("asset.update"),
      id,
      changes: assetSchema.omit({ id: true }).partial().extend({ checksum: hash }).strict(),
    })
    .strict(),
};
