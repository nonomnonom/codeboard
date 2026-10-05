import {
  parseJobManifest,
  MAX_MANIFEST_BYTES,
  type FrameJobManifest,
} from "./frame-job-contract.js";
import { DatabaseSync } from "node:sqlite";
import { openSync, closeSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { CodeboardError } from "../model/errors.js";
import { rollbackAfterFailure } from "../storage/transaction.js";
const APPLICATION_ID = 0x43424a31;
const MAX_FRAME_BYTES = 128 * 1024 * 1024;

export function createJobStore(path: string, input: FrameJobManifest): void {
  const manifest = parseJobManifest(input);
  mkdirSync(dirname(path), { recursive: true });
  let descriptor: number | undefined = openSync(path, "wx");
  let db: DatabaseSync | undefined;
  try {
    closeSync(descriptor);
    descriptor = undefined;
    db = new DatabaseSync(path);
    db.exec(`PRAGMA synchronous=FULL; BEGIN IMMEDIATE;
      PRAGMA application_id=${APPLICATION_ID}; PRAGMA user_version=1;
      CREATE TABLE job(id INTEGER PRIMARY KEY CHECK(id=1),manifest TEXT NOT NULL);
      CREATE TABLE frames(frame INTEGER PRIMARY KEY,sha256 TEXT NOT NULL,data BLOB NOT NULL);`);
    db.prepare("INSERT INTO job VALUES(1,?)").run(JSON.stringify(manifest));
    db.exec("COMMIT");
    db.close();
    db = undefined;
  } catch (error) {
    const failures: unknown[] = [error];
    try {
      if (descriptor !== undefined) closeSync(descriptor);
    } catch (cleanup) {
      failures.push(cleanup);
    }
    try {
      db?.close();
    } catch (cleanup) {
      failures.push(cleanup);
    }
    try {
      unlinkSync(path);
    } catch (cleanup) {
      failures.push(cleanup);
    }
    if (failures.length > 1)
      throw new AggregateError(failures, "Frame job creation and cleanup failed");
    throw error;
  }
}

function openJobStore(path: string, readOnly: boolean): DatabaseSync {
  if (!existsSync(path)) throw new CodeboardError("INVALID_ARGUMENT", "Frame job does not exist");
  const db = new DatabaseSync(path, { readOnly });
  try {
    db.exec("PRAGMA busy_timeout=5000; PRAGMA trusted_schema=OFF;");
    if (!readOnly) db.exec("PRAGMA synchronous=FULL;");
    if (
      Number(db.prepare("PRAGMA application_id").get()!.application_id) !== APPLICATION_ID ||
      Number(db.prepare("PRAGMA user_version").get()!.user_version) !== 1
    )
      throw new CodeboardError("INVALID_ARGUMENT", "Unsupported frame job container");
    return db;
  } catch (error) {
    if (readOnly && error instanceof Error && "errcode" in error && error.errcode === 776)
      closeFailedJobStore(
        db,
        new CodeboardError(
          "OPERATION_FAILED",
          "Frame job requires journal recovery; resume with runFrameJob using the matching source before reading",
          { details: { reason: "FRAME_JOB_RECOVERY_REQUIRED" }, cause: error },
        ),
      );
    closeFailedJobStore(db, error);
  }
}

function closeFailedJobStore(db: DatabaseSync, error: unknown): never {
  try {
    db.close();
  } catch (cleanup) {
    throw new AggregateError([error, cleanup], "Frame job operation and connection cleanup failed");
  }
  throw error;
}

export function withJobReadSnapshot<T>(path: string, work: (db: DatabaseSync) => T): T {
  const db = openJobStore(path, true);
  let result: T;
  try {
    db.exec("BEGIN");
    result = work(db);
  } catch (error) {
    closeFailedJobStore(db, error);
  }
  db.close();
  return result;
}

/** Own the connection lifetime; callers retain ownership of transaction boundaries. */
export async function withAsyncJobStore<T>(
  path: string,
  readOnly: boolean,
  work: (db: DatabaseSync) => Promise<T>,
): Promise<T> {
  const db = openJobStore(path, readOnly);
  let result: T;
  try {
    result = await work(db);
  } catch (error) {
    closeFailedJobStore(db, error);
  }
  db.close();
  return result;
}

export function withAsyncJobReadSnapshot<T>(
  path: string,
  work: (db: DatabaseSync) => Promise<T>,
): Promise<T> {
  return withAsyncJobStore(path, true, async (db) => {
    db.exec("BEGIN");
    return work(db);
  });
}

export function readJobManifest(db: DatabaseSync): FrameJobManifest {
  const row = db
    .prepare(`SELECT CASE WHEN typeof(manifest)='text' AND length(CAST(manifest AS BLOB))<=?
      THEN manifest ELSE NULL END AS manifest FROM job WHERE id=1`)
    .get(MAX_MANIFEST_BYTES);
  if (!row || typeof row.manifest !== "string")
    throw new CodeboardError("INVALID_ARGUMENT", "Missing or oversized frame job manifest");
  let input: unknown;
  try {
    input = JSON.parse(row.manifest);
  } catch (cause) {
    throw new CodeboardError("INVALID_ARGUMENT", "Frame job manifest is not valid JSON", { cause });
  }
  return parseJobManifest(input);
}

export function readJobFrame(db: DatabaseSync, frame: number): Buffer | undefined {
  const row = db
    .prepare(`SELECT length(data) AS bytes,
    CASE WHEN typeof(data)='blob' AND length(data)<=? THEN data ELSE NULL END AS data,
    CASE WHEN typeof(sha256)='text' AND length(sha256)=64 THEN sha256 ELSE NULL END AS sha256
    FROM frames WHERE frame=?`)
    .get(MAX_FRAME_BYTES, frame);
  if (!row) return undefined;
  if (Number(row.bytes) > MAX_FRAME_BYTES)
    throw new CodeboardError("RESOURCE_LIMIT", "Stored job frame exceeds 128 MiB");
  if (!(row.data instanceof Uint8Array))
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid frame payload");
  const bytes = Buffer.from(row.data);
  if (createHash("sha256").update(bytes).digest("hex") !== row.sha256)
    throw new CodeboardError("ASSET_CHECKSUM_MISMATCH", `Stored frame checksum differs: ${frame}`);
  return bytes;
}

export function storeJobFrame(
  db: DatabaseSync,
  manifest: FrameJobManifest,
  frame: number,
  bytes: Buffer,
): boolean {
  if (
    !Number.isSafeInteger(frame) ||
    frame < manifest.range.startFrame ||
    frame >= manifest.range.endFrame
  )
    throw new CodeboardError("INVALID_ARGUMENT", "Frame is outside the job range");
  if (bytes.length > MAX_FRAME_BYTES)
    throw new CodeboardError("RESOURCE_LIMIT", "Rendered job frame exceeds 128 MiB");
  db.exec("BEGIN IMMEDIATE");
  try {
    if (JSON.stringify(readJobManifest(db)) !== JSON.stringify(manifest))
      throw new CodeboardError("REVISION_CONFLICT", "Frame job definition changed");
    const previous = readJobFrame(db, frame);
    if (previous) {
      if (!previous.equals(bytes))
        throw new CodeboardError(
          "REVISION_CONFLICT",
          `Concurrent render differs for frame ${frame}`,
        );
      db.exec("COMMIT");
      return false;
    }
    const total = Number(
      db.prepare("SELECT COALESCE(SUM(length(data)),0) AS bytes FROM frames").get()!.bytes,
    );
    if (total + bytes.length > manifest.maxBytes)
      throw new CodeboardError("RESOURCE_LIMIT", "Frame job exceeds its PNG byte budget");
    db.prepare("INSERT INTO frames VALUES(?,?,?)").run(
      frame,
      createHash("sha256").update(bytes).digest("hex"),
      bytes,
    );
    db.exec("COMMIT");
    return true;
  } catch (error) {
    rollbackAfterFailure(db, error);
  }
}

export function jobProgress(db: DatabaseSync, manifest: FrameJobManifest) {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS count,COALESCE(SUM(length(data)),0) AS bytes,MIN(frame) AS first,MAX(frame) AS last FROM frames",
    )
    .get()!;
  const completed = Number(row.count),
    bytes = Number(row.bytes);
  const total = manifest.range.endFrame - manifest.range.startFrame;
  if (
    completed > total ||
    bytes > manifest.maxBytes ||
    (completed &&
      (Number(row.first) < manifest.range.startFrame ||
        Number(row.last) >= manifest.range.endFrame))
  )
    throw new CodeboardError("INVALID_ARGUMENT", "Frame job progress is inconsistent");
  return { completed, total, bytes, complete: completed === total };
}
