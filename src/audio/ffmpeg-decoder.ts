import { runMedia } from "./decoder-process.js";
import { setImmediate } from "node:timers/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { ffmpegExecutable, ffprobeExecutable } from "../runtime/dependencies.js";
import { rescaleTime } from "../animation/rational-time.js";
import { CodeboardError } from "../model/errors.js";
import type { StudioAudioDecoder } from "./mix.js";

export interface FFmpegAudioDecoderOptions {
  ffmpegPath?: string;
  ffprobePath?: string;
  timeoutMs?: number;
  maxAssetBytes?: number;
}
const settingsSchema = z
  .object({
    ffmpegPath: z.string().min(1).optional(),
    ffprobePath: z.string().min(1).optional(),
    timeoutMs: z.number().int().min(1).max(120000).default(30000),
    maxAssetBytes: z.number().int().min(1).max(268435456).default(67108864),
  })
  .strict();
const samples = z.number().int().positive().max(16777216),
  rate = z.number().int().min(8000).max(192000);
const requestSchema = z
  .object({
    assetId: z.string().min(1).max(4096),
    sourceSampleRate: rate,
    startSample: z.number().int().nonnegative().safe(),
    sampleCount: samples,
    outputSampleRate: rate,
    outputSampleCount: samples,
    signal: z.instanceof(AbortSignal).optional(),
  })
  .strict();

/** Asset byte identity is pinned on first use for the lifetime of the returned decoder. */
export function createFFmpegAudioDecoder(
  readAsset: (id: string) => Promise<Uint8Array> | Uint8Array,
  options: FFmpegAudioDecoderOptions = {},
): StudioAudioDecoder {
  const settings = settingsSchema.parse(options),
    pins = new Map<string, string>();
  if (typeof readAsset !== "function")
    throw new CodeboardError("INVALID_ARGUMENT", "Audio decoding requires an asset reader");
  return async (input) => {
    const request = requestSchema.parse(input);
    const { signal } = request;
    if (signal?.aborted) throw new CodeboardError("CANCELLED", "Audio decode cancelled");
    const end = request.startSample + request.sampleCount;
    if (
      !Number.isSafeInteger(end) ||
      rescaleTime(request.sampleCount, request.sourceSampleRate, request.outputSampleRate).value !==
        request.outputSampleCount
    )
      throw new CodeboardError("INVALID_ARGUMENT", "Audio decode range/count is inconsistent");
    const bytes = await readAsset(request.assetId);
    if (
      !(bytes instanceof Uint8Array) ||
      bytes.byteLength < 1 ||
      bytes.byteLength > settings.maxAssetBytes
    )
      throw new CodeboardError(
        "RESOURCE_LIMIT",
        "Audio asset exceeds decoder byte limit or is empty",
      );
    const media = Buffer.from(bytes),
      hash = createHash("sha256").update(media).digest("hex"),
      previous = pins.get(request.assetId);
    if (previous !== undefined && previous !== hash)
      throw new CodeboardError(
        "ASSET_CHECKSUM_MISMATCH",
        `Audio asset changed during decoding: ${request.assetId}`,
      );
    pins.set(request.assetId, hash);
    const run = (
      dependency: "ffmpeg" | "ffprobe",
      command: string,
      args: string[],
      data: Buffer,
      limit: number,
    ) => runMedia(dependency, command, args, data, limit, settings.timeoutMs, signal);
    const probe = await run(
      "ffprobe",
      ffprobeExecutable(settings.ffprobePath),
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "pipe",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=sample_rate,channels",
        "-of",
        "json",
        "-i",
        "pipe:0",
      ],
      media,
      65536,
    );
    const metadata = z
      .object({
        streams: z
          .array(
            z.object({
              sample_rate: z.string().regex(/^\d+$/),
              channels: z.number().int().min(1).max(2),
            }),
          )
          .length(1),
      })
      .parse(JSON.parse(probe.toString("utf8"))).streams[0]!;
    if (Number(metadata.sample_rate) !== request.sourceSampleRate)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Declared source sample rate differs from decoded media",
      );
    const channels = metadata.channels,
      frameBytes = channels * 4;
    const ffmpeg = ffmpegExecutable(settings.ffmpegPath);
    let pcm = await run(
      "ffmpeg",
      ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-protocol_whitelist",
        "pipe",
        "-i",
        "pipe:0",
        "-map",
        "0:a:0",
        "-af",
        `atrim=start_sample=${request.startSample}:end_sample=${end},asetpts=N/SR/TB`,
        "-ar",
        String(request.sourceSampleRate),
        "-ac",
        String(channels),
        "-c:a",
        "pcm_f32le",
        "-f",
        "f32le",
        "pipe:1",
      ],
      media,
      request.sampleCount * frameBytes,
    );
    if (pcm.byteLength !== request.sampleCount * frameBytes)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Audio source does not contain the requested decoded sample range",
      );
    if (request.outputSampleRate !== request.sourceSampleRate) {
      pcm = await run(
        "ffmpeg",
        ffmpeg,
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-f",
          "f32le",
          "-ar",
          String(request.sourceSampleRate),
          "-ac",
          String(channels),
          "-i",
          "pipe:0",
          "-af",
          `aresample=${request.outputSampleRate}`,
          "-c:a",
          "pcm_f32le",
          "-f",
          "f32le",
          "pipe:1",
        ],
        pcm,
        (request.outputSampleCount + 1) * frameBytes,
      );
    }
    if (
      pcm.byteLength < request.outputSampleCount * frameBytes ||
      pcm.byteLength % frameBytes !== 0
    )
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Resampler did not produce the required output samples",
      );
    const output = Array.from(
      { length: channels },
      () => new Float32Array(request.outputSampleCount),
    );
    for (let i = 0; i < request.outputSampleCount; i++) {
      if (i % 65536 === 0) {
        await setImmediate();
        if (signal?.aborted) throw new CodeboardError("CANCELLED", "Audio decode cancelled");
      }
      for (let channel = 0; channel < channels; channel++) {
        const value = pcm.readFloatLE((i * channels + channel) * 4);
        if (!Number.isFinite(value))
          throw new CodeboardError("INVALID_ARGUMENT", "Decoder produced nonfinite PCM");
        output[channel]![i] = value;
      }
    }
    if (signal?.aborted) throw new CodeboardError("CANCELLED", "Audio decode cancelled");
    return output;
  };
}
