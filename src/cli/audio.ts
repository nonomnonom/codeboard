import type { Command } from "commander";
import { open } from "node:fs/promises";
import { resolve } from "node:path";

import { CodeboardError } from "../model/errors.js";

import { cancellable } from "./cancellation.js";

async function readOptions(path: string): Promise<unknown> {
  const file = await open(resolve(path), "r");
  try {
    const maximum = 1024 * 1024;
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > maximum)
      throw new CodeboardError(
        "RESOURCE_LIMIT",
        "Stem options must be a regular JSON file no larger than 1 MiB",
      );
    const buffer = Buffer.allocUnsafe(maximum + 1);
    let total = 0;
    while (total <= maximum) {
      const { bytesRead } = await file.read(buffer, total, buffer.length - total);
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total > maximum) throw new CodeboardError("RESOURCE_LIMIT", "Stem options exceed 1 MiB");
    try {
      return JSON.parse(buffer.subarray(0, total).toString("utf8"));
    } catch (cause) {
      throw new CodeboardError("INVALID_ARGUMENT", "Stem options are not valid JSON", { cause });
    }
  } finally {
    await file.close();
  }
}

export function registerAudioCommands(program: Command): void {
  program
    .command("audio-stems")
    .argument("<project>", "Saved .cboard project")
    .argument("<options>", "JSON AudioStemExportOptions, at most 1 MiB")
    .requiredOption("-o, --output <directory>", "New stem package directory")
    .requiredOption("--expected-version <number>", "Required saved project version")
    .option("--shot <animation-id>")
    .option("--editorial <sequence-id>")
    .option("--ffmpeg <path>")
    .option("--ffprobe <path>")
    .action(
      async (
        path: string,
        config: string,
        options: {
          output: string;
          expectedVersion: string;
          shot?: string;
          editorial?: string;
          ffmpeg?: string;
          ffprobe?: string;
        },
      ) => {
        const [
          { StoryboardProject },
          { createFFmpegAudioDecoder },
          { exportAudioStems },
          { parseAudioStemOptions },
        ] = await Promise.all([
          import("../core/project.js"),
          import("../audio/ffmpeg-decoder.js"),
          import("../export/audio-stems.js"),
          import("../export/audio-stem-options.js"),
        ]);

        if ((options.shot === undefined) === (options.editorial === undefined))
          throw new CodeboardError(
            "INVALID_ARGUMENT",
            "Choose exactly one of --shot or --editorial",
          );
        const expected = /^\d+$/.test(options.expectedVersion)
          ? Number(options.expectedVersion)
          : NaN;
        if (!Number.isSafeInteger(expected))
          throw new CodeboardError(
            "INVALID_ARGUMENT",
            "Expected version must be a nonnegative safe integer",
          );
        const result = await cancellable(async (signal) => {
          const settings = parseAudioStemOptions(await readOptions(config));
          const project = await StoryboardProject.open(resolve(path));
          if (project.version !== expected)
            throw new CodeboardError(
              "REVISION_CONFLICT",
              "Saved project differs from expected version",
              {
                details: { expected, actual: project.version },
              },
            );
          const decoder = createFFmpegAudioDecoder(project.captureAssetReader(), {
            ...(options.ffmpeg === undefined ? {} : { ffmpegPath: options.ffmpeg }),
            ...(options.ffprobe === undefined ? {} : { ffprobePath: options.ffprobe }),
          });
          const target =
            options.shot !== undefined
              ? { kind: "shot" as const, animation: project.shotAnimation(options.shot) }
              : {
                  kind: "editorial" as const,
                  sequence: project.editorialSequence(options.editorial!),
                  animations: project.studio.animations,
                };
          return exportAudioStems(target, decoder, options.output, {
            stems: settings.stems,
            sampleFormat: settings.sampleFormat,
            transitions: settings.transitions,
            mix: {
              sampleRate: settings.mix.sampleRate,
              maxSamples: settings.mix.maxSamples,
              ...(settings.mix.range === undefined ? {} : { range: settings.mix.range }),
              signal,
            },
          });
        });
        console.log(JSON.stringify(result, null, 2));
      },
    );

  program
    .command("verify-audio-stems")
    .argument("<directory>", "Completed stem package")
    .action(async (directory: string) => {
      const { verifyAudioStems } = await import("../export/verify-audio-stems.js");

      const result = await cancellable((signal) => verifyAudioStems(directory, { signal }));
      console.log(JSON.stringify(result, null, 2));
    });
}
