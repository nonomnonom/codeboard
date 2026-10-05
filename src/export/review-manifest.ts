import { z } from "zod";
import { reviewTargetSchema, type ReviewManifest } from "./review-contract.js";
import { CodeboardError } from "../model/errors.js";

export const MAX_REVIEW_MANIFEST_BYTES = 2 * 1024 * 1024;
const id = z.string().min(1).max(4096);
const count = z.number().int().nonnegative().safe();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const sourceAddress = z.object({ clipId: id, animationId: id, sourceFrame: count }).strict();
const source = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("board"),
      panelId: id,
      incomingPanelId: id.optional(),
      transitionProgress: z.number().min(0).max(1),
    })
    .strict(),
  z.object({ kind: z.literal("shot"), animationId: id, sourceFrame: count }).strict(),
  z
    .object({
      kind: z.literal("editorial"),
      sequenceId: id,
      outgoing: sourceAddress,
      incoming: sourceAddress.optional(),
      transition: z.enum(["cut", "dissolve", "wipe-left", "wipe-right"]),
      transitionProgress: z.number().min(0).max(1),
    })
    .strict(),
]);
const schema = z
  .object({
    format: z.literal("codeboard-review/2"),
    createdAt: z.iso.datetime(),
    source: z
      .object({
        projectId: id,
        version: count,
        schemaVersion: count.positive(),
        documentHash: hash,
        revision: z.string().min(1).max(128).optional(),
      })
      .strict(),
    renderer: z.object({ package: id, version: id, node: id, platform: id }).strict(),
    settings: z
      .object({
        target: reviewTargetSchema,
        annotations: z.boolean(),
        frameRate: z
          .object({ numerator: count.positive(), denominator: count.positive() })
          .strict(),
        space: z.literal("camera"),
        imageFormat: z.literal("PNG"),
      })
      .strict(),
    frames: z
      .array(
        z
          .object({
            frame: count,
            file: z.string().max(128),
            sha256: hash,
            bytes: count.positive().max(128 * 1024 * 1024),
            width: count.positive(),
            height: count.positive(),
            source,
          })
          .strict(),
      )
      .min(1)
      .max(120),
  })
  .strict();

/** Validate exported review metadata; hashes bind bytes, not reviewer identity or artistic approval. */
export function readReviewManifest(input: unknown): ReviewManifest {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid review manifest", {
      details: { issues: parsed.error.issues },
    });
  const manifest = parsed.data;
  if (Buffer.byteLength(JSON.stringify(manifest)) > MAX_REVIEW_MANIFEST_BYTES)
    throw new CodeboardError("RESOURCE_LIMIT", "Review manifest exceeds 2 MiB");
  const seen = new Set<number>();
  let bytes = 0,
    pixels = 0;
  for (const [index, frame] of manifest.frames.entries()) {
    if (
      seen.has(frame.frame) ||
      frame.file !== `${String(index + 1).padStart(3, "0")}-frame-${frame.frame}.png`
    )
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Review frame identity or filename is inconsistent",
        { details: { index } },
      );
    seen.add(frame.frame);
    const target = manifest.settings.target,
      record = frame.source;
    if (
      target.kind !== record.kind ||
      (target.kind === "shot" &&
        record.kind === "shot" &&
        (target.animationId !== record.animationId || record.sourceFrame !== frame.frame)) ||
      (target.kind === "editorial" &&
        record.kind === "editorial" &&
        target.sequenceId !== record.sequenceId)
    )
      throw new CodeboardError("INVALID_ARGUMENT", "Review frame source differs from its target", {
        details: { index },
      });
    const area = frame.width * frame.height;
    bytes += frame.bytes;
    pixels += area;
    if (
      !Number.isSafeInteger(area) ||
      area > 32 * 1024 * 1024 ||
      pixels > 512 * 1024 * 1024 ||
      bytes > 128 * 1024 * 1024
    )
      throw new CodeboardError("RESOURCE_LIMIT", "Review exceeds its image byte or pixel budget");
  }
  return manifest as ReviewManifest;
}
