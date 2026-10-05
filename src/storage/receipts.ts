import type { DatabaseSync } from "node:sqlite";
import type { PayloadCodec } from "./codec.js";
import type { CommitReceipt } from "../core/edit-plan/types.js";
import { receiptSchema } from "../core/edit-plan/schema.js";
import { CodeboardError } from "../model/errors.js";

function receiptKey(requestId: string): string {
  if (typeof requestId !== "string" || !requestId.trim() || requestId.length > 4096)
    throw new CodeboardError("INVALID_ARGUMENT", "Request ID must contain 1–4096 characters");
  return `request:${requestId}`;
}

function parseReceipt(requestId: string, input: unknown): CommitReceipt {
  const receipt = receiptSchema.parse(input);
  if (receipt.requestId !== requestId || receipt.committedVersion !== receipt.baseVersion + 1)
    throw new Error("Invalid request receipt identity or version");
  return receipt;
}

/** The caller owns the read snapshot or write transaction. */
export function readReceipt(
  db: DatabaseSync,
  codec: PayloadCodec,
  requestId: string,
): CommitReceipt | null {
  const row = db.prepare("SELECT hash FROM roots WHERE key=?").get(receiptKey(requestId));
  return row ? parseReceipt(requestId, codec.read(String(row.hash))) : null;
}

/** Publish once inside the same transaction as the committed document. */
export function writeReceipt(db: DatabaseSync, codec: PayloadCodec, receipt: CommitReceipt): void {
  const key = receiptKey(receipt.requestId);
  const parsed = parseReceipt(receipt.requestId, receipt);
  db.prepare("INSERT INTO roots(key,hash) VALUES(?,?)").run(key, codec.write(parsed));
}

export function verifyReceipts(db: DatabaseSync, codec: PayloadCodec): void {
  for (const row of db.prepare("SELECT key,hash FROM roots WHERE key LIKE 'request:%'").all()) {
    const requestId = String(row.key).slice("request:".length);
    if (receiptKey(requestId) !== String(row.key))
      throw new Error("Invalid request receipt identity or version");
    parseReceipt(requestId, codec.read(String(row.hash)));
  }
}
