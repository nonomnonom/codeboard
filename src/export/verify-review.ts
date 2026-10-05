import { realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { readPackageFile } from "./package-file.js";
import { readReviewManifest, MAX_REVIEW_MANIFEST_BYTES } from "./review-manifest.js";
import { CodeboardError } from "../model/errors.js";

/** Verify review evidence without reopening or modifying its source project. */
export async function verifyReviewExport(
  directory: string,
  options: { decode?: boolean; signal?: AbortSignal } = {},
) {
  const parsed = z
    .object({ decode: z.boolean().default(false), signal: z.instanceof(AbortSignal).optional() })
    .strict()
    .safeParse(options);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid review verification options", {
      details: { issues: parsed.error.issues },
    });
  const settings = parsed.data;
  settings.signal?.throwIfAborted();
  const root = await realpath(directory),
    chunks: Buffer[] = [];
  for await (const chunk of readPackageFile(
    root,
    "manifest.json",
    MAX_REVIEW_MANIFEST_BYTES,
    settings.signal,
  ))
    chunks.push(chunk);
  const encodedManifest = Buffer.concat(chunks);
  let input: unknown;
  try {
    input = JSON.parse(encodedManifest.toString("utf8"));
  } catch (cause) {
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid review manifest JSON", { cause });
  }
  const manifest = readReviewManifest(input);
  let bytes = 0;
  for (const frame of manifest.frames) {
    const digest = createHash("sha256");
    const encoded = settings.decode ? Buffer.allocUnsafe(frame.bytes) : undefined;
    let count = 0;
    for await (const chunk of readPackageFile(root, frame.file, frame.bytes, settings.signal)) {
      if (encoded) chunk.copy(encoded, count);
      count += chunk.length;
      digest.update(chunk);
    }
    if (count !== frame.bytes || digest.digest("hex") !== frame.sha256)
      throw new CodeboardError(
        "ASSET_CHECKSUM_MISMATCH",
        "Review frame differs from its manifest",
        { details: { file: frame.file } },
      );
    if (encoded) {
      const { inspectSequenceImage } = await import("./sequence-image.js");
      await inspectSequenceImage(encoded, frame.file, frame, false);
    }
    settings.signal?.throwIfAborted();
    bytes += count;
  }
  return {
    directory: root,
    manifest,
    manifestSha256: createHash("sha256").update(encodedManifest).digest("hex"),
    verified: manifest.frames.length,
    decoded: settings.decode ? manifest.frames.length : 0,
    bytes,
  };
}
