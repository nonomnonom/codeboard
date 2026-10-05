import type { DatabaseSync } from "node:sqlite";
import type { PayloadCodec } from "./codec.js";
import { readRoot } from "./roots.js";
import { readStoredHeader } from "./document-read.js";
import { catalogCurrent, readCatalogMetadata } from "./catalog.js";
import { editorialSequenceSchema } from "../model/schema/editorial.js";
import { boundQueryResponse } from "../model/query.js";
import { CodeboardError } from "../model/errors.js";

/** Caller owns the read snapshot; clip discovery does not require shot artwork decoding. */
export function queryEditorialClips(
  db: DatabaseSync,
  codec: PayloadCodec,
  sequenceId: string,
  limit: number,
  offset: number,
  expected: number | undefined,
) {
  const metadata = catalogCurrent(db) ? readCatalogMetadata(db) : readStoredHeader(db, codec);
  if (expected !== undefined && expected !== metadata.version)
    throw new CodeboardError("REVISION_CONFLICT", "Project version changed; restart the query", {
      details: { expected, actual: metadata.version },
    });
  const entries =
    Number(db.prepare("PRAGMA user_version").get()!.user_version) === 1
      ? []
      : codec.readObjectField<unknown>(readRoot(db, "studio"), "editorial");
  if (!Array.isArray(entries))
    throw new CodeboardError("OPERATION_FAILED", "Stored editorial collection is invalid");
  const matches = entries.filter(
    (entry) => entry && typeof entry === "object" && entry.id === sequenceId,
  );
  if (!matches.length)
    throw new CodeboardError("INVALID_ARGUMENT", `Editorial sequence not found: ${sequenceId}`);
  if (matches.length !== 1)
    throw new CodeboardError("OPERATION_FAILED", "Stored editorial sequence identity is ambiguous");
  const sequence = editorialSequenceSchema.parse(matches[0]);
  const last = sequence.clips.at(-1)!;
  const durationFrames = last.startFrame + last.durationFrames;
  if (!Number.isSafeInteger(durationFrames))
    throw new CodeboardError("OPERATION_FAILED", "Stored editorial duration exceeds safe limits");
  return boundQueryResponse(
    {
      version: metadata.version,
      sequenceId: sequence.id,
      frameRate: sequence.frameRate,
      durationFrames,
      clipCount: sequence.clips.length,
      items: sequence.clips.slice(offset, offset + limit),
    },
    "Stored editorial response",
  );
}
