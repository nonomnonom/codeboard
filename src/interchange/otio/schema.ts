import { z } from "zod";

const time = z
  .object({
    OTIO_SCHEMA: z.literal("RationalTime.1"),
    rate: z.number().finite().positive(),
    value: z.number().int().safe(),
  })
  .strict();
const range = z
  .object({
    OTIO_SCHEMA: z.literal("TimeRange.1"),
    start_time: time,
    duration: time.extend({ value: z.number().int().positive().safe() }),
  })
  .strict();
const named = {
  name: z.string().max(4096).default(""),
  metadata: z.record(z.string(), z.unknown()).default({}),
};
const item = {
  ...named,
  enabled: z.literal(true).default(true),
  effects: z.array(z.unknown()).max(0).default([]),
  markers: z.array(z.unknown()).default([]),
  color: z.unknown().optional(),
};
export const timelineSchema = z
  .object({
    ...named,
    OTIO_SCHEMA: z.literal("Timeline.1"),
    global_start_time: time.nullish(),
    tracks: z
      .object({
        ...item,
        OTIO_SCHEMA: z.literal("Stack.1"),
        source_range: z.null().optional(),
        children: z.array(z.unknown()).min(1).max(1000),
      })
      .strict(),
  })
  .strict();
export const trackSchema = z
  .object({
    ...item,
    OTIO_SCHEMA: z.literal("Track.1"),
    kind: z.enum(["Video", "Audio"]),
    source_range: z.null().optional(),
    children: z.array(z.unknown()).max(1000),
  })
  .strict();
const clipItem = { ...item, source_range: range };
export const clipSchema = z.discriminatedUnion("OTIO_SCHEMA", [
  z
    .object({ ...clipItem, OTIO_SCHEMA: z.literal("Clip.1"), media_reference: z.unknown() })
    .strict(),
  z
    .object({
      ...clipItem,
      OTIO_SCHEMA: z.literal("Clip.2"),
      active_media_reference_key: z.string().min(1),
      media_references: z.record(z.string(), z.unknown()),
    })
    .strict(),
]);
export const referenceSchema = z
  .object({
    ...named,
    OTIO_SCHEMA: z.literal("ExternalReference.1"),
    target_url: z.string().min(1).max(4096),
    available_range: range.nullish(),
    available_image_bounds: z.unknown().optional(),
  })
  .strict();
export const clipIdentitySchema = z.object({ clipId: z.string().min(1).max(4096) }).strict();
