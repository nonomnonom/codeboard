import { mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { setImmediate } from "node:timers/promises";
import { CodeboardError } from "../model/errors.js";
import { assertFrameLimit } from "./limits.js";
import { parseFrameSequenceManifest } from "./frame-sequence-manifest.js";
import {
  withAsyncJobReadSnapshot,
  readJobManifest,
  readJobFrame,
  jobProgress,
} from "./frame-job-store.js";

export interface FrameJobSequenceOptions {
  maxFrames?: number;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

/** Publish verified stored PNGs and a completion manifest without rerendering. */
export async function exportFrameJobSequence(
  jobPath: string,
  outputDir: string,
  options: FrameJobSequenceOptions = {},
) {
  const settings = { ...options };
  if (settings.signal !== undefined && !(settings.signal instanceof AbortSignal))
    throw new CodeboardError("INVALID_ARGUMENT", "Sequence signal must be an AbortSignal");
  if (settings.onProgress !== undefined && typeof settings.onProgress !== "function")
    throw new CodeboardError("INVALID_ARGUMENT", "Sequence progress callback must be a function");
  settings.signal?.throwIfAborted();
  return withAsyncJobReadSnapshot(resolve(jobPath), async (db) => {
    const source = readJobManifest(db),
      progress = jobProgress(db, source);
    if (!progress.complete)
      throw new CodeboardError("INVALID_ARGUMENT", "Complete the frame job before sequence export");
    assertFrameLimit(progress.total, settings.maxFrames);
    const directory = resolve(outputDir),
      parent = dirname(directory);
    await mkdir(parent, { recursive: true });
    settings.signal?.throwIfAborted();
    try {
      await mkdir(directory);
    } catch (cause) {
      if (cause instanceof Error && "code" in cause && cause.code === "EEXIST")
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Sequence output directory must not already exist",
          {
            details: { directory },
            cause,
          },
        );
      throw cause;
    }
    try {
      await mkdir(join(directory, "frames"));
      const records = await open(join(directory, "frames.jsonl"), "wx");
      const digest = createHash("sha256");
      let bytes = 0,
        recordBytes = 0;
      let writeFailure: unknown;
      let writeFailed = false;
      try {
        for (let position = 0; position < progress.total; position++) {
          await setImmediate();
          settings.signal?.throwIfAborted();
          const frame = source.range.startFrame + position;
          const png = readJobFrame(db, frame);
          if (!png) throw new CodeboardError("INVALID_ARGUMENT", `Missing job frame: ${frame}`);
          const file = `frames/${String(position).padStart(6, "0")}.png`;
          await writeFile(join(directory, file), png, { flag: "wx" });
          const line = `${JSON.stringify({ frame, file, bytes: png.length, sha256: createHash("sha256").update(png).digest("hex") })}\n`;
          await records.writeFile(line, "utf8");
          digest.update(line);
          recordBytes += Buffer.byteLength(line);
          bytes += png.length;
          settings.onProgress?.(position + 1, progress.total);
        }
      } catch (error) {
        writeFailed = true;
        writeFailure = error;
      }
      try {
        await records.close();
      } catch (error) {
        if (writeFailed)
          throw new AggregateError([writeFailure, error], "Sequence writing and file close failed");
        throw error;
      }
      if (writeFailed) throw writeFailure;
      if (bytes !== progress.bytes)
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Sequence bytes disagree with frame job records",
        );
      const manifest = parseFrameSequenceManifest({
        format: "codeboard-frame-sequence/1",
        source,
        frameCount: progress.total,
        framePattern: "frames/%06d.png",
        startNumber: 0,
        bytes,
        checksums: { file: "frames.jsonl", bytes: recordBytes, sha256: digest.digest("hex") },
      });
      const manifestFile = join(directory, "sequence.json");
      settings.signal?.throwIfAborted();
      await writeFile(
        join(directory, ".sequence.json.tmp"),
        `${JSON.stringify(manifest, null, 2)}\n`,
        { flag: "wx" },
      );
      settings.signal?.throwIfAborted();
      await rename(join(directory, ".sequence.json.tmp"), manifestFile);
      return {
        directory,
        manifestFile,
        frameCount: progress.total,
        bytes,
        range: { ...source.range },
        frameRate: { ...source.frameRate },
      };
    } catch (error) {
      try {
        const path = relative(parent, directory);
        if (!path || path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path))
          throw new Error("Unsafe sequence cleanup path");
        await rm(directory, { recursive: true, force: true });
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], "Sequence export and cleanup failed");
      }
      throw error;
    }
  });
}
