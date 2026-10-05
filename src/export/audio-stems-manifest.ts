import { z } from "zod";
import { audioTrackSelectionSchema } from "../audio/selection.js";
import { CodeboardError } from "../model/errors.js";
import type { AudioStemManifest } from "./audio-stems.js";

export const MAX_STEM_MANIFEST_BYTES = 8 * 1024 * 1024;
const integer = z.number().int().nonnegative().safe();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const schema = z
  .object({
    format: z.literal("codeboard-audio-stems/1"),
    source: z
      .object({
        kind: z.enum(["shot", "editorial"]),
        id: z.string().min(1).max(4096),
        fingerprint: hash,
      })
      .strict(),
    sampleRate: z.number().int().min(8000).max(192000),
    sampleFormat: z.enum(["pcm16", "float32"]),
    transitions: z.enum(["sum", "linear"]),
    range: z.object({ startSample: integer, endSample: integer }).strict(),
    stems: z
      .array(
        z
          .object({
            name: z.string().min(1).max(256),
            tracks: audioTrackSelectionSchema,
            file: z.string().regex(/^stem-\d{3}\.wav$/),
            sha256: hash,
            bytes: integer,
            samples: integer.positive().max(16777216),
            peak: z.number().finite().nonnegative(),
            clippedSamples: integer,
          })
          .strict(),
      )
      .min(1)
      .max(32),
  })
  .strict();

export function parseAudioStemManifest(input: unknown): AudioStemManifest {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid audio stem manifest", {
      details: { issues: parsed.error.issues },
    });
  const manifest = parsed.data;
  const samples = manifest.range.endSample - manifest.range.startSample;
  const headerBytes = manifest.sampleFormat === "pcm16" ? 44 : 58;
  const bytesPerSample = manifest.sampleFormat === "pcm16" ? 4 : 8;
  const names = new Set<string>();
  for (const [index, stem] of manifest.stems.entries()) {
    if (
      names.has(stem.name) ||
      stem.file !== `stem-${String(index + 1).padStart(3, "0")}.wav` ||
      stem.samples !== samples ||
      stem.bytes !== headerBytes + samples * bytesPerSample ||
      stem.clippedSamples > samples * 2 ||
      (manifest.sampleFormat === "pcm16" && (stem.clippedSamples !== 0 || stem.peak > 1)) ||
      stem.peak > 1 !== stem.clippedSamples > 0
    )
      throw new CodeboardError("INVALID_ARGUMENT", "Inconsistent audio stem manifest");
    names.add(stem.name);
    const refs = new Set(
      stem.tracks.map((track) => JSON.stringify([track.ownerId, track.trackId])),
    );
    if (refs.size !== stem.tracks.length)
      throw new CodeboardError("INVALID_ARGUMENT", "Duplicate stem track reference");
  }
  return manifest;
}
