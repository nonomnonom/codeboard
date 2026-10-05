import { spawn } from "node:child_process";
import { mkdir, rename, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { ffmpegExecutable, dependencyStartupError } from "../runtime/dependencies.js";
import { normalizeRate, type RationalRate } from "../animation/rational-time.js";
import { CodeboardError } from "../model/errors.js";
import { assertFrameLimit } from "./limits.js";

export interface MovieEncodingOptions {
  ffmpegPath?: string;
  maxFrames?: number;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

export function assertMovieFrames(total: number, maximum = 100000): void {
  assertFrameLimit(total, maximum);
  if (total < 1)
    throw new CodeboardError(
      "RESOURCE_LIMIT",
      "Movie frame count exceeds export limit or is empty",
    );
}

/** Own the shared image pipe, child lifetime and temporary movie publication. */
export async function encodeMovie(
  output: string,
  total: number,
  frameRate: number | RationalRate,
  png: (frame: number) => Promise<Buffer>,
  audioArgs: readonly string[],
  options: MovieEncodingOptions,
) {
  assertMovieFrames(total, options.maxFrames);
  options.signal?.throwIfAborted();
  const rate = normalizeRate(frameRate),
    seconds = total / (rate.numerator / rate.denominator);
  if (!Number.isFinite(seconds) || seconds <= 0)
    throw new CodeboardError("RESOURCE_LIMIT", "Movie duration exceeds the supported range");
  const destination = resolve(output),
    temporary = `${destination}.${randomUUID()}.mp4`;
  await mkdir(dirname(destination), { recursive: true });
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "image2pipe",
    "-framerate",
    `${rate.numerator}/${rate.denominator}`,
    "-vcodec",
    "png",
    "-i",
    "pipe:0",
    ...audioArgs,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-threads",
    "2",
    "-movflags",
    "+faststart",
    "-frames:v",
    String(total),
    "-t",
    String(seconds),
    temporary,
  ];
  const started = performance.now();
  let peakRss = process.memoryUsage().rss;
  const executable = ffmpegExecutable(options.ffmpegPath);
  const child = spawn(executable, args, {
    windowsHide: true,
    stdio: ["pipe", "ignore", "pipe"],
    ...(options.signal ? { signal: options.signal } : {}),
  });
  let error: Error | undefined,
    stderr = "";
  child.stderr.on("data", (data: Buffer) => {
    stderr = (stderr + data.toString()).slice(-12000);
  });
  child.on("error", (value) => {
    error = dependencyStartupError("ffmpeg", executable, value);
  });
  child.stdin.on("error", (value) => {
    error = value;
  });
  const finished = new Promise<number | null>((ready) => child.on("close", ready));
  const startedProcess = new Promise<void>((ready, reject) => {
    child.once("spawn", ready);
    child.once("error", (cause) => reject(dependencyStartupError("ffmpeg", executable, cause)));
  });
  let failure: unknown;
  try {
    await startedProcess;
    for (let frame = 0; frame < total; frame++) {
      options.signal?.throwIfAborted();
      if (error) throw error;
      const bytes = await png(frame);
      options.signal?.throwIfAborted();
      if (error) throw error;
      await new Promise<void>((ready, reject) =>
        child.stdin.write(bytes, (error) => (error ? reject(error) : ready())),
      );
      options.onProgress?.(frame + 1, total);
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
    }
    child.stdin.end();
    const code = await finished;
    if (error || code !== 0)
      throw new Error(`FFmpeg failed (${code}): ${error?.message ?? stderr}`);
    options.signal?.throwIfAborted();
    await rename(temporary, destination);
    return {
      file: destination,
      frames: total,
      seconds,
      renderSeconds: (performance.now() - started) / 1000,
      peakRssBytes: peakRss,
    };
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await finished;
    try {
      await unlink(temporary);
    } catch (cleanup) {
      if (!(cleanup instanceof Error) || !("code" in cleanup) || cleanup.code !== "ENOENT") {
        if (failure !== undefined)
          // biome-ignore lint/correctness/noUnsafeFinally: Cleanup reports retain the original failure in AggregateError.
          throw new AggregateError(
            [failure, cleanup],
            `Movie failed; incomplete file remains at ${temporary}`,
          );
        // biome-ignore lint/correctness/noUnsafeFinally: With no earlier failure, report the failed cleanup.
        throw cleanup;
      }
    }
  }
}
