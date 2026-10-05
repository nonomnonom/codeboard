import type { Command } from "commander";
import { resolve } from "node:path";

import { CodeboardError } from "../../model/errors.js";

import type { StudioMovieOptions } from "../../export/studio-movie.js";

export function registerMovieCommand(program: Command): void {
  program
    .command("movie")
    .argument("<project>")
    .requiredOption("-o, --output <file>")
    .option("--ffmpeg <path>")
    .option("--shot <animation-id>", "Export a shot movie")
    .option("--editorial <sequence-id>", "Export an editorial movie")
    .option("--start-frame <number>", "Inclusive studio range start; requires --end-frame")
    .option("--end-frame <number>", "Exclusive studio range end; requires --start-frame")
    .option("--omit-audio", "Explicitly omit authored studio audio")
    .option("--mix-audio <policy>", "Mix studio audio with sum or linear transitions")
    .option("--ffprobe <path>", "ffprobe executable for studio audio mixing")
    .action(
      async (
        path: string,
        options: {
          output: string;
          ffmpeg?: string;
          shot?: string;
          editorial?: string;
          omitAudio?: boolean;
          mixAudio?: string;
          ffprobe?: string;
          startFrame?: string;
          endFrame?: string;
        },
      ) => {
        const [
          { StoryboardProject },
          { createFFmpegAudioDecoder },
          { exportShotMovie, exportEditorialMovie },
          { exportMovie },
        ] = await Promise.all([
          import("../../core/project.js"),
          import("../../audio/ffmpeg-decoder.js"),
          import("../../export/studio-movie.js"),
          import("../../export/movie-export.js"),
        ]);

        let range: StudioMovieOptions["range"];
        if (options.startFrame !== undefined || options.endFrame !== undefined) {
          const startFrame = /^\d+$/.test(options.startFrame ?? "")
            ? Number(options.startFrame)
            : NaN;
          const endFrame = /^\d+$/.test(options.endFrame ?? "") ? Number(options.endFrame) : NaN;
          if (
            !Number.isSafeInteger(startFrame) ||
            !Number.isSafeInteger(endFrame) ||
            endFrame <= startFrame ||
            (options.shot === undefined && options.editorial === undefined)
          )
            throw new CodeboardError(
              "INVALID_ARGUMENT",
              "Provide a nonempty --start-frame/--end-frame range with a studio movie target",
            );
          range = { startFrame, endFrame };
        }
        if (options.shot !== undefined && options.editorial !== undefined)
          throw new CodeboardError("INVALID_ARGUMENT", "Choose either --shot or --editorial");
        if (options.mixAudio !== undefined && !["sum", "linear"].includes(options.mixAudio))
          throw new CodeboardError("INVALID_ARGUMENT", "--mix-audio must be sum or linear");
        if (options.omitAudio && options.mixAudio !== undefined)
          throw new CodeboardError("INVALID_ARGUMENT", "Choose either --mix-audio or --omit-audio");
        if (options.ffprobe !== undefined && options.mixAudio === undefined)
          throw new CodeboardError("INVALID_ARGUMENT", "--ffprobe requires --mix-audio");
        if (
          (options.omitAudio || options.mixAudio !== undefined) &&
          options.shot === undefined &&
          options.editorial === undefined
        )
          throw new CodeboardError(
            "INVALID_ARGUMENT",
            "Studio audio flags require a studio movie target",
          );
        const project = await StoryboardProject.open(resolve(path));
        const settings = {
          onProgress: (n: number, total: number) => {
            if (n % 24 === 0) console.log(`${n}/${total} frames`);
          },
          ...(options.ffmpeg ? { ffmpegPath: options.ffmpeg } : {}),
        };
        const studioSettings: StudioMovieOptions = {
          ...settings,
          ...(range === undefined ? {} : { range }),
          ...(options.mixAudio === undefined
            ? options.omitAudio
              ? { audio: "omit" as const }
              : {}
            : {
                audio: {
                  mode: "mix" as const,
                  decoder: createFFmpegAudioDecoder(project.captureAssetReader(), {
                    ...(options.ffmpeg ? { ffmpegPath: options.ffmpeg } : {}),
                    ...(options.ffprobe ? { ffprobePath: options.ffprobe } : {}),
                  }),
                  transitions: options.mixAudio as "sum" | "linear",
                },
              }),
        };
        const result =
          options.shot !== undefined
            ? await exportShotMovie(
                project.shotAnimation(options.shot),
                options.output,
                studioSettings,
              )
            : options.editorial !== undefined
              ? await exportEditorialMovie(
                  project.editorialSequence(options.editorial),
                  project.studio.animations,
                  options.output,
                  studioSettings,
                )
              : await exportMovie(project, options.output, settings);
        console.log(result);
      },
    );
}
