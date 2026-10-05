import { mkdir, open, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { CodeboardError } from "../model/errors.js";
import {
  withAsyncJobReadSnapshot,
  readJobManifest,
  readJobFrame,
  jobProgress,
} from "./frame-job-store.js";
import { matchingJobSource } from "./frame-job-source.js";
import { prepareJobFonts } from "./frame-job-fonts.js";
import {
  prepareShotMovie,
  prepareEditorialMovie,
  type StudioMovieOptions,
} from "./studio-movie-source.js";
import { publishStudioMovie } from "./studio-movie-publish.js";

export interface FrameJobMovieOptions extends Omit<StudioMovieOptions, "range"> {
  sourcePath?: string;
}

/** Encode completed job PNGs without rerendering, with the normal studio audio policy. */
export async function exportFrameJobMovie(
  jobPath: string,
  output: string,
  options: FrameJobMovieOptions = {},
) {
  const settings = { ...options };
  settings.signal?.throwIfAborted();
  return withAsyncJobReadSnapshot(resolve(jobPath), async (db) => {
    const manifest = readJobManifest(db);
    if (
      manifest.outputProfile?.alpha === "preserve" ||
      (manifest.target.kind === "shot" &&
        manifest.target.render?.background === "transparent" &&
        manifest.outputProfile?.alpha !== "flatten")
    )
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "H.264 cannot preserve alpha; create a job with an explicit flatten output profile",
      );
    if (!jobProgress(db, manifest).complete)
      throw new CodeboardError("INVALID_ARGUMENT", "Complete the frame job before movie export");
    const document = matchingJobSource(manifest, settings.sourcePath);
    if (settings.fontPolicy === "require-available")
      prepareJobFonts(document, settings.sourcePath ?? manifest.source.path, manifest.fontFiles);
    const studioOptions = { ...settings, range: manifest.range };
    let prepared: Pick<
      Awaited<ReturnType<typeof prepareShotMovie>>,
      "selected" | "settings" | "mix"
    >;
    if (manifest.target.kind === "shot") {
      const id = manifest.target.animationId;
      const animation = document.studio.animations.find((item) => item.id === id);
      if (!animation) throw new CodeboardError("INVALID_ARGUMENT", "Frame job shot does not exist");
      prepared = await prepareShotMovie(animation, studioOptions, manifest.outputProfile);
    } else {
      const id = manifest.target.sequenceId;
      const sequence = document.studio.editorial.find((item) => item.id === id);
      if (!sequence)
        throw new CodeboardError("INVALID_ARGUMENT", "Frame job editorial sequence does not exist");
      prepared = await prepareEditorialMovie(
        sequence,
        document.studio.animations,
        studioOptions,
        manifest.outputProfile,
      );
    }
    if (JSON.stringify(prepared.selected.frameRate) !== JSON.stringify(manifest.frameRate))
      throw new CodeboardError("REVISION_CONFLICT", "Frame job frame rate differs");
    settings.signal?.throwIfAborted();
    const destination = resolve(output);
    await mkdir(dirname(destination), { recursive: true });
    const reserved = await open(destination, "wx");
    try {
      await reserved.close();
      const result = await publishStudioMovie(
        {
          ...prepared.selected,
          png: async (position) => {
            const frame = manifest.range.startFrame + position;
            const bytes = readJobFrame(db, frame);
            if (!bytes) throw new CodeboardError("INVALID_ARGUMENT", `Missing job frame: ${frame}`);
            return bytes;
          },
        },
        destination,
        prepared.settings,
        prepared.mix,
      );
      return { ...result, job: resolve(jobPath), source: { ...manifest.source } };
    } catch (error) {
      const failures: unknown[] = [error];
      try {
        await reserved.close();
      } catch (cleanup) {
        failures.push(cleanup);
      }
      try {
        await unlink(destination);
      } catch (cleanup) {
        failures.push(cleanup);
      }
      if (failures.length > 1)
        throw new AggregateError(failures, "Job movie export and cleanup failed");
      throw error;
    }
  });
}
