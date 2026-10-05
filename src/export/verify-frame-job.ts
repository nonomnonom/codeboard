import { resolve } from "node:path";
import { setImmediate } from "node:timers/promises";
import { CodeboardError } from "../model/errors.js";
import {
  withAsyncJobReadSnapshot,
  readJobManifest,
  readJobFrame,
  jobProgress,
} from "./frame-job-store.js";

export interface VerifyFrameJobOptions {
  signal?: AbortSignal;
  onProgress?: (visited: number, total: number) => void;
}

/** Verify all stored frame hashes in one read snapshot, including incomplete jobs. */
export async function verifyFrameJob(jobPath: string, options: VerifyFrameJobOptions = {}) {
  const settings = { ...options };
  if (settings.signal !== undefined && !(settings.signal instanceof AbortSignal))
    throw new CodeboardError("INVALID_ARGUMENT", "Frame job signal must be an AbortSignal");
  if (settings.onProgress !== undefined && typeof settings.onProgress !== "function")
    throw new CodeboardError("INVALID_ARGUMENT", "Frame job progress callback must be a function");
  settings.signal?.throwIfAborted();
  const file = resolve(jobPath);
  return withAsyncJobReadSnapshot(file, async (db) => {
    const manifest = readJobManifest(db),
      progress = jobProgress(db, manifest);
    let verified = 0,
      bytes = 0;
    for (let frame = manifest.range.startFrame; frame < manifest.range.endFrame; frame++) {
      await setImmediate();
      settings.signal?.throwIfAborted();
      const png = readJobFrame(db, frame);
      if (png) {
        verified++;
        bytes += png.length;
      }
      settings.onProgress?.(frame - manifest.range.startFrame + 1, progress.total);
    }
    settings.signal?.throwIfAborted();
    if (verified !== progress.completed || bytes !== progress.bytes)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Frame job records disagree with their verified payloads",
      );
    return { file, manifest, ...progress, verified, missing: progress.total - verified };
  });
}
