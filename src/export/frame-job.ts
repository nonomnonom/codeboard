import { parseJobManifest, type FrameJobManifest } from "./frame-job-contract.js";
import { resolve } from "node:path";
import { frameOutput } from "./frame-output.js";
import { prepareJobFonts } from "./frame-job-fonts.js";
import { readJobSource, matchingJobSource } from "./frame-job-source.js";
import type { StoryboardDocument } from "../model/types.js";
import { CodeboardError } from "../model/errors.js";
import { fingerprint } from "../core/edit-plan/fingerprint.js";
import { renderIdentity } from "../runtime/render-identity.js";
import { setImmediate } from "node:timers/promises";
import { createShotRenderSession } from "../render/shot.js";
import { createEditorialRenderSession } from "../render/editorial.js";
import { checkShotFonts, validateFontPolicy } from "../render/fonts.js";
import { resolveFrameRange, assertFrameLimit } from "./limits.js";
import {
  createJobStore,
  withAsyncJobStore,
  readJobManifest,
  readJobFrame,
  storeJobFrame,
  jobProgress,
} from "./frame-job-store.js";

export interface FrameJobOptions {
  expectedVersion: number;
  target: FrameJobManifest["target"];
  range?: { startFrame: number; endFrame: number };
  maxBytes?: number;
  fontPolicy?: "allow-fallback" | "require-available";
  outputProfile?: FrameJobManifest["outputProfile"];
  fontFiles?: FrameJobManifest["fontFiles"];
}

function renderSession(
  document: StoryboardDocument,
  target: FrameJobManifest["target"],
  fontPolicy?: FrameJobOptions["fontPolicy"],
) {
  validateFontPolicy(fontPolicy);
  if (target?.kind === "shot") {
    const animation = document.studio.animations.find((entry) => entry.id === target.animationId);
    if (!animation) throw new CodeboardError("INVALID_ARGUMENT", "Frame job shot does not exist");
    checkShotFonts([animation], fontPolicy);
    return createShotRenderSession(animation, target.render);
  }
  if (target?.kind !== "editorial")
    throw new CodeboardError("INVALID_ARGUMENT", "Frame job requires a shot or editorial target");
  const sequence = document.studio.editorial.find((entry) => entry.id === target.sequenceId);
  if (!sequence)
    throw new CodeboardError("INVALID_ARGUMENT", "Frame job editorial sequence does not exist");
  if (fontPolicy === "require-available") {
    const ids = new Set(sequence.clips.map((clip) => clip.animationId));
    checkShotFonts(
      document.studio.animations.filter((animation) => ids.has(animation.id)),
      fontPolicy,
    );
  }
  return createEditorialRenderSession(sequence, document.studio.animations);
}

/** Define a new job against saved source content; keep that source or a matching copy available. */
export function createFrameJob(sourcePath: string, jobPath: string, options: FrameJobOptions) {
  if (!Number.isSafeInteger(options.expectedVersion) || options.expectedVersion < 0)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Expected version must be a nonnegative safe integer",
    );
  const path = resolve(sourcePath),
    document = readJobSource(path);
  if (document.version !== options.expectedVersion)
    throw new CodeboardError("REVISION_CONFLICT", "Frame job source differs from expected version");
  const documentHash = fingerprint(document);
  prepareJobFonts(document, path, options.fontFiles);
  const session = renderSession(document, options.target, options.fontPolicy);
  const range = resolveFrameRange(session.durationFrames, options.range);
  assertFrameLimit(range.endFrame - range.startFrame);
  const manifest = parseJobManifest({
    format: "codeboard-frame-job/1",
    source: {
      path,
      projectId: document.id,
      version: document.version,
      documentHash,
    },
    target: options.target,
    range,
    frameRate: session.frameRate,
    renderer: renderIdentity(),
    maxBytes: options.maxBytes ?? 512 * 1024 * 1024,
    ...(options.fontPolicy === undefined ? {} : { fontPolicy: options.fontPolicy }),
    ...(options.outputProfile === undefined ? {} : { outputProfile: options.outputProfile }),
    ...(options.fontFiles === undefined ? {} : { fontFiles: options.fontFiles }),
  });
  const file = resolve(jobPath);
  createJobStore(file, manifest);
  return { file, manifest };
}

export interface RunFrameJobOptions {
  sourcePath?: string;
  range?: { startFrame: number; endFrame: number };
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

/** Persist each PNG and checksum atomically; retries verify and skip already stored frames. */
export async function runFrameJob(jobPath: string, options: RunFrameJobOptions = {}) {
  const settings = { ...options };
  if (settings.signal !== undefined && !(settings.signal instanceof AbortSignal))
    throw new CodeboardError("INVALID_ARGUMENT", "Frame job signal must be an AbortSignal");
  if (settings.onProgress !== undefined && typeof settings.onProgress !== "function")
    throw new CodeboardError("INVALID_ARGUMENT", "Frame job progress callback must be a function");
  settings.signal?.throwIfAborted();
  const file = resolve(jobPath);
  return withAsyncJobStore(file, false, async (db) => {
    const manifest = readJobManifest(db);
    jobProgress(db, manifest);
    if (JSON.stringify(renderIdentity()) !== JSON.stringify(manifest.renderer))
      throw new CodeboardError("REVISION_CONFLICT", "Frame job renderer identity differs");
    const document = matchingJobSource(manifest, settings.sourcePath);
    const assertFonts = prepareJobFonts(
      document,
      settings.sourcePath ?? manifest.source.path,
      manifest.fontFiles,
    );
    const session = renderSession(document, manifest.target, manifest.fontPolicy);
    if (JSON.stringify(session.frameRate) !== JSON.stringify(manifest.frameRate))
      throw new CodeboardError("REVISION_CONFLICT", "Frame job frame rate differs");
    const range = resolveFrameRange(
      session.durationFrames,
      settings.range === undefined ? manifest.range : settings.range,
    );
    if (range.startFrame < manifest.range.startFrame || range.endFrame > manifest.range.endFrame)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Worker range must lie within the frame job range",
      );
    let rendered = 0,
      reused = 0;
    for (let frame = range.startFrame; frame < range.endFrame; frame++) {
      await setImmediate();
      settings.signal?.throwIfAborted();
      assertFonts();
      if (readJobFrame(db, frame)) reused++;
      else {
        const bytes = await frameOutput(await session.png(frame), manifest.outputProfile);
        assertFonts();
        settings.signal?.throwIfAborted();
        if (storeJobFrame(db, manifest, frame, bytes)) rendered++;
        else reused++;
      }
      settings.onProgress?.(frame - range.startFrame + 1, range.endFrame - range.startFrame);
    }
    settings.signal?.throwIfAborted();
    assertFonts();
    if (JSON.stringify(renderIdentity()) !== JSON.stringify(manifest.renderer))
      throw new CodeboardError("REVISION_CONFLICT", "Frame job renderer changed during execution");
    if (JSON.stringify(readJobManifest(db)) !== JSON.stringify(manifest))
      throw new CodeboardError("REVISION_CONFLICT", "Frame job definition changed");
    return { file, rendered, reused, ...jobProgress(db, manifest) };
  });
}

export { inspectFrameJob, readFrameJobFrame } from "./frame-job-read.js";
