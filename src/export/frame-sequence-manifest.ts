import { z } from "zod";
import { parseJobManifest } from "./frame-job-contract.js";
import { CodeboardError } from "../model/errors.js";

export const MAX_SEQUENCE_MANIFEST_BYTES = 1024 * 1024;
const integer = z.number().int().nonnegative().safe();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const schema = z
  .object({
    format: z.literal("codeboard-frame-sequence/1"),
    source: z.unknown(),
    frameCount: integer.positive().max(100000),
    framePattern: z.literal("frames/%06d.png"),
    startNumber: z.literal(0),
    bytes: integer.max(1024 * 1024 * 1024),
    checksums: z
      .object({
        file: z.literal("frames.jsonl"),
        bytes: integer.positive().max(32 * 1024 * 1024),
        sha256: hash,
      })
      .strict(),
  })
  .strict();

export const frameSequenceRecordSchema = z
  .object({
    frame: integer,
    file: z.string().regex(/^frames\/\d{6}\.png$/),
    bytes: integer.positive().max(128 * 1024 * 1024),
    sha256: hash,
  })
  .strict();

export function parseFrameSequenceManifest(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid frame sequence manifest", {
      cause: parsed.error,
    });
  const source = parseJobManifest(parsed.data.source);
  if (
    parsed.data.frameCount !== source.range.endFrame - source.range.startFrame ||
    parsed.data.bytes > source.maxBytes
  )
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Frame sequence manifest disagrees with its source job",
    );
  return { ...parsed.data, source };
}
