import { open, realpath, lstat } from "node:fs/promises";
import { join, relative, isAbsolute, sep } from "node:path";
import { createHash } from "node:crypto";
import { CodeboardError } from "../model/errors.js";
import { parseAudioStemManifest, MAX_STEM_MANIFEST_BYTES } from "./audio-stems-manifest.js";

/** Validate package metadata and stream file hashes; this does not decode or audition WAVs. */
export async function verifyAudioStems(directory: string, options: { signal?: AbortSignal } = {}) {
  const signal = options.signal;
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new CodeboardError("INVALID_ARGUMENT", "Stem verification signal must be an AbortSignal");
  signal?.throwIfAborted();
  const root = await realpath(directory);
  async function openFile(name: string) {
    const path = join(root, name);
    if (!(await lstat(path)).isFile())
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Stem package entries must be regular files, not links",
      );
    const resolved = await realpath(path),
      inside = relative(root, resolved);
    if (!inside || inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside))
      throw new CodeboardError("INVALID_ARGUMENT", "Stem package file is outside its directory");
    return open(resolved, "r");
  }
  const manifestHandle = await openFile("stems.json");
  let input: unknown;
  try {
    const stat = await manifestHandle.stat();
    if (!stat.isFile() || stat.size > MAX_STEM_MANIFEST_BYTES)
      throw new CodeboardError(
        "RESOURCE_LIMIT",
        "Stem manifest must be a regular file no larger than 8 MiB",
      );
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      signal?.throwIfAborted();
      const buffer = Buffer.allocUnsafe(Math.min(65536, MAX_STEM_MANIFEST_BYTES + 1 - total));
      const { bytesRead } = await manifestHandle.read(buffer);
      if (!bytesRead) break;
      total += bytesRead;
      if (total > MAX_STEM_MANIFEST_BYTES)
        throw new CodeboardError("RESOURCE_LIMIT", "Stem manifest exceeds 8 MiB");
      chunks.push(buffer.subarray(0, bytesRead));
    }
    try {
      input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch (cause) {
      throw new CodeboardError("INVALID_ARGUMENT", "Stem manifest is not valid JSON", { cause });
    }
  } finally {
    await manifestHandle.close();
  }
  const manifest = parseAudioStemManifest(input);
  for (const stem of manifest.stems) {
    signal?.throwIfAborted();
    const file = await openFile(stem.file);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size !== stem.bytes)
        throw new CodeboardError("INVALID_ARGUMENT", `Stem byte count differs: ${stem.file}`);
      const hash = createHash("sha256"),
        buffer = Buffer.allocUnsafe(65536);
      let total = 0;
      while (true) {
        signal?.throwIfAborted();
        const { bytesRead } = await file.read(
          buffer,
          0,
          Math.min(buffer.length, stem.bytes + 1 - total),
        );
        if (!bytesRead) break;
        total += bytesRead;
        if (total > stem.bytes)
          throw new CodeboardError(
            "INVALID_ARGUMENT",
            `Stem grew during verification: ${stem.file}`,
          );
        hash.update(buffer.subarray(0, bytesRead));
      }
      if (total !== stem.bytes || hash.digest("hex") !== stem.sha256)
        throw new CodeboardError("ASSET_CHECKSUM_MISMATCH", `Stem checksum differs: ${stem.file}`);
    } finally {
      await file.close();
    }
  }
  signal?.throwIfAborted();
  return { directory: root, manifest };
}
