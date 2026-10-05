import { resolve } from "node:path";
import { CodeboardError } from "../model/errors.js";
import {
  withJobReadSnapshot,
  readJobManifest,
  readJobFrame,
  jobProgress,
} from "./frame-job-store.js";

export function inspectFrameJob(jobPath: string) {
  const file = resolve(jobPath);
  return withJobReadSnapshot(file, (db) => {
    const manifest = readJobManifest(db);
    return { file, manifest, ...jobProgress(db, manifest) };
  });
}

export function readFrameJobFrame(jobPath: string, frame: number): Buffer {
  return withJobReadSnapshot(resolve(jobPath), (db) => {
    const manifest = readJobManifest(db);
    if (
      !Number.isSafeInteger(frame) ||
      frame < manifest.range.startFrame ||
      frame >= manifest.range.endFrame
    )
      throw new CodeboardError("INVALID_ARGUMENT", "Frame is outside the job range");
    const bytes = readJobFrame(db, frame);
    if (!bytes) throw new CodeboardError("INVALID_ARGUMENT", "Frame has not completed");
    return bytes;
  });
}
