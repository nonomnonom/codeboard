import { backup, type DatabaseSync } from "node:sqlite";
import { mkdir, mkdtemp, link, rm, stat } from "node:fs/promises";
import { resolve, dirname, join, basename } from "node:path";
import { CodeboardError } from "../model/errors.js";
import { fingerprint } from "../core/edit-plan/fingerprint.js";
import { openContainer } from "./container.js";
import { PayloadCodec } from "./codec.js";
import { readStoredDocument } from "./document-read.js";
import { verifyContainer } from "./integrity.js";

export interface CopyProjectOptions {
  expectedVersion: number;
  maxBytes?: number;
  signal?: AbortSignal;
}

/** The store owns the open source connection; publish only a fully verified pinned backup. */
export async function copyProjectContainer(
  db: DatabaseSync,
  destination: string,
  source: { projectId: string; version: number; documentHash: string },
  options: CopyProjectOptions,
) {
  const maxBytes = options.maxBytes ?? 1024 * 1024 * 1024;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1024 * 1024 * 1024)
    throw new CodeboardError("INVALID_ARGUMENT", "Project copy budget must be 1 byte to 1 GiB");
  if (options.signal !== undefined && !(options.signal instanceof AbortSignal))
    throw new CodeboardError("INVALID_ARGUMENT", "Project copy signal must be an AbortSignal");
  const cancelled = () => {
    if (options.signal?.aborted) throw new CodeboardError("CANCELLED", "Project copy cancelled");
  };
  cancelled();
  const path = resolve(destination),
    parent = dirname(path);
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(join(parent, ".codeboard-copy-"));
  const temporary = join(directory, "snapshot.cboard");
  let failure: unknown;
  try {
    const pageSize = Number(db.prepare("PRAGMA page_size").get()!.page_size);
    await backup(db, temporary, {
      progress: ({ totalPages }) => {
        cancelled();
        if (totalPages * pageSize > maxBytes)
          throw new CodeboardError("RESOURCE_LIMIT", "Project copy exceeds its byte budget");
      },
    });
    cancelled();
    if ((await stat(temporary)).size > maxBytes)
      throw new CodeboardError("RESOURCE_LIMIT", "Project copy exceeds its byte budget");
    const copied = openContainer(temporary, false);
    try {
      const codec = new PayloadCodec(copied);
      const document = readStoredDocument(copied, codec);
      if (
        document.id !== source.projectId ||
        document.version !== source.version ||
        fingerprint(document) !== source.documentHash
      )
        throw new CodeboardError("REVISION_CONFLICT", "Project changed during snapshot copy");
      verifyContainer(copied, codec, () => document);
    } finally {
      copied.close();
    }
    cancelled();
    // Both paths are on the same filesystem. link fails atomically if the destination exists.
    await link(temporary, path);
    return { path, ...source };
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    if (dirname(directory) === parent && basename(directory).startsWith(".codeboard-copy-")) {
      try {
        await rm(directory, { recursive: true, force: true });
      } catch (cleanup) {
        // biome-ignore lint/correctness/noUnsafeFinally: Preserve the primary failure alongside cleanup failure.
        throw new AggregateError(
          failure === undefined ? [cleanup] : [failure, cleanup],
          `Project copy cleanup failed: ${directory}`,
        );
      }
    }
  }
}
