import { realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { CodeboardError } from "../model/errors.js";
import { readPackageFile } from "./package-file.js";
import { inspectSequenceImage } from "./sequence-image.js";
import {
  parseFrameSequenceManifest,
  frameSequenceRecordSchema,
  MAX_SEQUENCE_MANIFEST_BYTES,
} from "./frame-sequence-manifest.js";

export interface VerifyFrameSequenceOptions {
  decode?: boolean;
  signal?: AbortSignal;
  onProgress?: (verified: number, total: number) => void;
}

/** Check package records/hashes, optionally decode PNGs, without accessing source paths. */
export async function verifyFrameSequence(
  directory: string,
  options: VerifyFrameSequenceOptions = {},
) {
  const settings = { ...options };
  if (settings.decode !== undefined && typeof settings.decode !== "boolean")
    throw new CodeboardError("INVALID_ARGUMENT", "Sequence decode option must be boolean");
  if (settings.signal !== undefined && !(settings.signal instanceof AbortSignal))
    throw new CodeboardError("INVALID_ARGUMENT", "Sequence signal must be an AbortSignal");
  if (settings.onProgress !== undefined && typeof settings.onProgress !== "function")
    throw new CodeboardError("INVALID_ARGUMENT", "Sequence progress callback must be a function");
  settings.signal?.throwIfAborted();
  const root = await realpath(directory),
    chunks: Buffer[] = [];
  for await (const chunk of readPackageFile(
    root,
    "sequence.json",
    MAX_SEQUENCE_MANIFEST_BYTES,
    settings.signal,
  ))
    chunks.push(chunk);
  function json(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch (cause) {
      throw new CodeboardError("INVALID_ARGUMENT", "Invalid frame sequence JSON", { cause });
    }
  }
  const manifest = parseFrameSequenceManifest(json(Buffer.concat(chunks).toString("utf8")));
  const digest = createHash("sha256");
  let dimensions: { width: number; height: number } | undefined = manifest.source.outputProfile;
  let transparentFrames = 0;
  let pending = Buffer.alloc(0),
    recordBytes = 0,
    verified = 0,
    bytes = 0;
  for await (const chunk of readPackageFile(
    root,
    "frames.jsonl",
    manifest.checksums.bytes,
    settings.signal,
  )) {
    recordBytes += chunk.length;
    digest.update(chunk);
    pending = Buffer.concat([pending, chunk]);
    while (true) {
      const newline = pending.indexOf(10);
      if (newline === -1) break;
      if (newline > 1024 || verified >= manifest.frameCount)
        throw new CodeboardError("RESOURCE_LIMIT", "Frame sequence record limit exceeded");
      const parsed = frameSequenceRecordSchema.safeParse(
        json(pending.subarray(0, newline).toString("utf8")),
      );
      pending = pending.subarray(newline + 1);
      if (!parsed.success)
        throw new CodeboardError("INVALID_ARGUMENT", "Invalid frame checksum record", {
          cause: parsed.error,
        });
      const record = parsed.data,
        expected = `frames/${String(verified).padStart(6, "0")}.png`;
      if (
        record.file !== expected ||
        record.frame !== manifest.source.range.startFrame + verified ||
        bytes + record.bytes > manifest.bytes
      )
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Frame sequence order, range or byte count differs",
        );
      const hash = createHash("sha256");
      const encoded = settings.decode ? Buffer.allocUnsafe(record.bytes) : undefined;
      let count = 0;
      for await (const png of readPackageFile(root, expected, record.bytes, settings.signal)) {
        if (encoded) png.copy(encoded, count);
        count += png.length;
        hash.update(png);
      }
      if (count !== record.bytes || hash.digest("hex") !== record.sha256)
        throw new CodeboardError(
          "ASSET_CHECKSUM_MISMATCH",
          `Sequence frame checksum differs: ${expected}`,
        );
      if (encoded) {
        settings.signal?.throwIfAborted();
        const image = await inspectSequenceImage(
          encoded,
          expected,
          dimensions,
          manifest.source.outputProfile?.alpha === "flatten",
        );
        dimensions = { width: image.width, height: image.height };
        if (image.transparent) transparentFrames++;
        settings.signal?.throwIfAborted();
      }
      bytes += count;
      verified++;
      settings.onProgress?.(verified, manifest.frameCount);
    }
    if (pending.length > 1024)
      throw new CodeboardError("RESOURCE_LIMIT", "Frame checksum record exceeds 1 KiB");
  }
  if (
    pending.length ||
    verified !== manifest.frameCount ||
    bytes !== manifest.bytes ||
    recordBytes !== manifest.checksums.bytes
  )
    throw new CodeboardError("INVALID_ARGUMENT", "Incomplete or inconsistent frame sequence");
  if (digest.digest("hex") !== manifest.checksums.sha256)
    throw new CodeboardError(
      "ASSET_CHECKSUM_MISMATCH",
      "Frame checksum file differs from sequence manifest",
    );
  settings.signal?.throwIfAborted();
  return {
    directory: root,
    manifest,
    verified,
    bytes,
    ...(settings.decode && dimensions
      ? {
          images: {
            ...dimensions,
            decoded: verified,
            transparentFrames,
            opaqueFrames: verified - transparentFrames,
          },
        }
      : {}),
  };
}
