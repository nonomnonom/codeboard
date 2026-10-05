import type { Command } from "commander";
import { resolve } from "node:path";
import { CodeboardError } from "../model/errors.js";

import { cancellable } from "./cancellation.js";
import { writeNewFrame } from "./frame-output.js";

function integer(value: string, name: string): number {
  const result = /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(result))
    throw new CodeboardError("INVALID_ARGUMENT", `${name} must be a nonnegative safe integer`);
  return result;
}

interface RangeFlags {
  startFrame?: string;
  endFrame?: string;
}

function rangeOptions(options: RangeFlags) {
  if (options.startFrame === undefined && options.endFrame === undefined) return {};
  if (options.startFrame === undefined || options.endFrame === undefined)
    throw new CodeboardError("INVALID_ARGUMENT", "Supply both --start-frame and --end-frame");
  return {
    range: {
      startFrame: integer(options.startFrame, "Start frame"),
      endFrame: integer(options.endFrame, "End frame"),
    },
  };
}

export function registerFrameJobCommands(program: Command): void {
  const jobs = program
    .command("frame-job")
    .description("Persist and resume shot/editorial PNG frames");
  jobs
    .command("create")
    .argument("<project>", "Saved .cboard source")
    .requiredOption("-o, --output <file>", "New SQLite job file")
    .requiredOption("--expected-version <number>", "Required saved project version")
    .option("--shot <animation-id>")
    .option("--editorial <sequence-id>")
    .option("--start-frame <number>")
    .option("--end-frame <number>", "Exclusive frame endpoint")
    .option("--max-bytes <number>", "Stored PNG byte budget, at most 1 GiB")
    .action(
      async (
        project: string,
        options: RangeFlags & {
          output: string;
          expectedVersion: string;
          shot?: string;
          editorial?: string;
          maxBytes?: string;
        },
      ) => {
        const { createFrameJob } = await import("../export/frame-job.js");

        if ((options.shot === undefined) === (options.editorial === undefined))
          throw new CodeboardError(
            "INVALID_ARGUMENT",
            "Choose exactly one of --shot or --editorial",
          );
        const result = createFrameJob(project, options.output, {
          expectedVersion: integer(options.expectedVersion, "Expected version"),
          target:
            options.shot !== undefined
              ? { kind: "shot", animationId: options.shot }
              : { kind: "editorial", sequenceId: options.editorial! },
          ...rangeOptions(options),
          ...(options.maxBytes === undefined
            ? {}
            : { maxBytes: integer(options.maxBytes, "Maximum bytes") }),
        });
        console.log(JSON.stringify(result, null, 2));
      },
    );

  jobs
    .command("run")
    .argument("<job>")
    .option("--source <project>", "Matching source at a different path")
    .option("--start-frame <number>")
    .option("--end-frame <number>", "Exclusive worker endpoint")
    .action(async (job: string, options: RangeFlags & { source?: string }) => {
      const { runFrameJob } = await import("../export/frame-job.js");

      const range = rangeOptions(options);
      const result = await cancellable((signal) =>
        runFrameJob(job, {
          ...range,
          ...(options.source === undefined ? {} : { sourcePath: options.source }),
          signal,
        }),
      );
      console.log(JSON.stringify(result, null, 2));
    });

  jobs
    .command("movie")
    .argument("<job>")
    .requiredOption("-o, --output <file>", "New MP4 output file")
    .option("--source <project>", "Matching source at a different path")
    .option("--omit-audio", "Explicitly omit studio audio")
    .option("--mix-audio <policy>", "Mix studio audio: sum or linear")
    .option("--ffmpeg <path>")
    .option("--ffprobe <path>")
    .action(
      async (
        job: string,
        options: {
          output: string;
          source?: string;
          omitAudio?: boolean;
          mixAudio?: string;
          ffmpeg?: string;
          ffprobe?: string;
        },
      ) => {
        const [
          { inspectFrameJob },
          { exportFrameJobMovie },
          { StoryboardProject },
          { createFFmpegAudioDecoder },
        ] = await Promise.all([
          import("../export/frame-job-read.js"),
          import("../export/frame-job-movie.js"),
          import("../core/project.js"),
          import("../audio/ffmpeg-decoder.js"),
        ]);

        if (options.omitAudio && options.mixAudio !== undefined)
          throw new CodeboardError("INVALID_ARGUMENT", "Choose audio mixing or omission");
        const policy = options.mixAudio;
        if (policy !== undefined && policy !== "sum" && policy !== "linear")
          throw new CodeboardError("INVALID_ARGUMENT", "Audio mix policy must be sum or linear");
        const result = await cancellable(async (signal) => {
          const project =
            policy === undefined
              ? undefined
              : await StoryboardProject.open(
                  resolve(options.source ?? inspectFrameJob(job).manifest.source.path),
                );
          return exportFrameJobMovie(job, options.output, {
            signal,
            ...(options.source === undefined ? {} : { sourcePath: options.source }),
            ...(options.ffmpeg === undefined ? {} : { ffmpegPath: options.ffmpeg }),
            ...(policy === undefined
              ? options.omitAudio
                ? { audio: "omit" as const }
                : {}
              : {
                  audio: {
                    mode: "mix" as const,
                    transitions: policy,
                    decoder: createFFmpegAudioDecoder(project!.captureAssetReader(), {
                      ...(options.ffmpeg === undefined ? {} : { ffmpegPath: options.ffmpeg }),
                      ...(options.ffprobe === undefined ? {} : { ffprobePath: options.ffprobe }),
                    }),
                  },
                }),
          });
        });
        console.log(JSON.stringify(result, null, 2));
      },
    );

  jobs
    .command("verify")
    .argument("<job>")
    .action(async (job: string) => {
      const { verifyFrameJob } = await import("../export/verify-frame-job.js");

      const result = await cancellable((signal) => verifyFrameJob(job, { signal }));
      console.log(JSON.stringify(result, null, 2));
    });

  jobs
    .command("inspect")
    .argument("<job>")
    .action(async (job: string) => {
      const { inspectFrameJob } = await import("../export/frame-job-read.js");

      console.log(JSON.stringify(inspectFrameJob(job), null, 2));
    });

  jobs
    .command("read")
    .argument("<job>")
    .argument("<frame>")
    .requiredOption("-o, --output <file>", "New PNG output file")
    .action(async (job: string, frame: string, options: { output: string }) => {
      const { readFrameJobFrame } = await import("../export/frame-job-read.js");

      const position = integer(frame, "Frame"),
        output = resolve(options.output);
      const png = readFrameJobFrame(job, position);
      await writeNewFrame(output, png);
      console.log(
        JSON.stringify({ file: resolve(job), frame: position, output, bytes: png.length }, null, 2),
      );
    });
}
