import { mkdir, mkdtemp, open, rm } from "node:fs/promises";
import { dirname, join, resolve, basename } from "node:path";
import type { AudioMixResult } from "../audio/mix.js";
import type { RationalRate } from "../animation/rational-time.js";
import { CodeboardError } from "../model/errors.js";
import { encodeMovie, type MovieEncodingOptions } from "./movie-encoder.js";

export interface StudioMovieFrames {
  range: { startFrame: number; endFrame: number };
  durationFrames: number;
  frameRate: RationalRate;
  png: (frame: number) => Promise<Buffer>;
}

export async function publishStudioMovie(
  session: StudioMovieFrames,
  output: string,
  options: MovieEncodingOptions,
  mix?: AudioMixResult,
) {
  if (!mix)
    return {
      ...(await encodeMovie(
        output,
        session.durationFrames,
        session.frameRate,
        session.png,
        ["-map", "0:v", "-an"],
        options,
      )),
      audio: { mode: "omitted" as const },
      range: { ...session.range },
    };
  if (mix.clippedSamples)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Studio audio exceeds full scale; revise track gains before export",
      { details: { peak: mix.peak, clippedSamples: mix.clippedSamples } },
    );
  options.signal?.throwIfAborted();
  const parent = dirname(resolve(output));
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(join(parent, ".codeboard-studio-audio-"));
  let failure: unknown;
  try {
    const path = join(directory, "mix.f32le"),
      file = await open(path, "wx");
    try {
      for (let start = 0; start < mix.channels[0].length; start += 65536) {
        options.signal?.throwIfAborted();
        const count = Math.min(65536, mix.channels[0].length - start),
          buffer = Buffer.allocUnsafe(count * 8);
        for (let i = 0; i < count; i++)
          for (let channel = 0; channel < 2; channel++)
            buffer.writeFloatLE(mix.channels[channel]![start + i]!, i * 8 + channel * 4);
        await file.writeFile(buffer);
      }
    } finally {
      await file.close();
    }
    const args = [
      "-f",
      "f32le",
      "-ar",
      String(mix.sampleRate),
      "-ac",
      "2",
      "-i",
      path,
      "-map",
      "0:v",
      "-map",
      "1:a",
      "-c:a",
      "aac",
      "-ar",
      String(mix.sampleRate),
      "-b:a",
      "192k",
    ];
    const result = await encodeMovie(
      output,
      session.durationFrames,
      session.frameRate,
      session.png,
      args,
      options,
    );
    return {
      ...result,
      range: { ...session.range },
      audio: {
        mode: "mixed" as const,
        sampleRate: mix.sampleRate,
        samples: mix.channels[0].length,
        range: { ...mix.range },
        peak: mix.peak,
        clippedSamples: mix.clippedSamples,
      },
    };
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    if (
      dirname(directory) === parent &&
      basename(directory).startsWith(".codeboard-studio-audio-")
    ) {
      try {
        await rm(directory, { recursive: true, force: true });
      } catch (cleanup) {
        // biome-ignore lint/correctness/noUnsafeFinally: Cleanup reports retain the original failure in AggregateError.
        throw new AggregateError(
          failure === undefined ? [cleanup] : [failure, cleanup],
          `Studio movie audio cleanup failed: ${directory}`,
        );
      }
    }
  }
}
