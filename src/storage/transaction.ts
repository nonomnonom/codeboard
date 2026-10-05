import type { DatabaseSync } from "node:sqlite";

/** Preserve the operation error if rollback also fails. */
export function rollbackAfterFailure(
  db: DatabaseSync,
  error: unknown,
  scope: "write" | "read-snapshot" = "write",
): never {
  // SQLITE_FULL and I/O failures can roll back the entire transaction automatically.
  if (!db.isTransaction) throw error;
  try {
    db.exec(scope === "write" ? "ROLLBACK" : "ROLLBACK TO read_snapshot; RELEASE read_snapshot");
  } catch (cleanup) {
    throw new AggregateError([error, cleanup], "Storage operation and rollback failed");
  }
  throw error;
}
