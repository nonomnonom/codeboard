import type { DatabaseSync } from "node:sqlite";
import type { PayloadCodec } from "./codec.js";
import type { StoryboardDocument } from "../model/types.js";
import type { EditPlan, CommitReceipt, CommitResult } from "../core/edit-plan/types.js";
import { fingerprint } from "../core/edit-plan/fingerprint.js";
import { CodeboardError } from "../model/errors.js";
import { readStoredDocument } from "./document-read.js";
import { writeDocument } from "./document-write.js";
import { readReceipt, writeReceipt } from "./receipts.js";

/** Commit a parsed plan result under the caller's immediate write transaction. */
export function writePlanCommit(
  db: DatabaseSync,
  codec: PayloadCodec,
  path: string,
  document: StoryboardDocument,
  plan: EditPlan,
  requestId: string,
): CommitResult {
  const existing = readReceipt(db, codec, requestId);
  if (existing) {
    if (existing.digest !== plan.digest)
      throw new CodeboardError(
        "REQUEST_ID_REUSED",
        "Request ID was already committed with a different plan",
        { details: { requestId } },
      );
    return { receipt: existing, replayed: true };
  }
  const source = readStoredDocument(db, codec);
  if (
    source.id !== plan.projectId ||
    source.version !== plan.baseVersion ||
    fingerprint(source) !== plan.baseHash
  )
    throw new CodeboardError(
      "REVISION_CONFLICT",
      "Saved project differs from the plan base; reopen and create a new plan",
      { details: { expected: plan.baseVersion, actual: source.version } },
    );
  if (document.id !== source.id || document.version !== source.version + 1)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Plan result must be one transaction on the source project",
    );
  const committedVersion = writeDocument(db, codec, path, document, {
    expectedVersion: plan.baseVersion,
  });
  const receipt: CommitReceipt = {
    requestId,
    digest: plan.digest,
    projectId: plan.projectId,
    actor: plan.actor,
    baseVersion: plan.baseVersion,
    committedVersion,
    committedAt: new Date().toISOString(),
  };
  writeReceipt(db, codec, receipt);
  return { receipt, replayed: false };
}
