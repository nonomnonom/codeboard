import type { AudioSampleRounding } from "./sample-clock.js";
import { setImmediate } from "node:timers/promises";
import { parseAudioMixOptions as options } from "./mix-options.js";
import type { ShotAnimation } from "../model/types/shot.js";
import type { EditorialSequence } from "../model/types/editorial.js";
import { conformShotAudio, conformEditorialAudio, type AudioConform } from "./conform.js";
import { CodeboardError } from "../model/errors.js";
import type { AudioTrackRef } from "./selection.js";

export interface AudioDecodeRequest {
  assetId: string;
  sourceSampleRate: number;
  startSample: number;
  sampleCount: number;
  outputSampleRate: number;
  outputSampleCount: number;
  signal?: AbortSignal;
}
/** Return trimmed/resampled mono or stereo PCM; the adapter must verify source rate and range. */
export type StudioAudioDecoder = (request: AudioDecodeRequest) => Promise<Float32Array[]>;
export interface AudioMixOptions {
  rounding?: AudioSampleRounding;
  range?: { startSample: number; endSample: number };
  tracks?: readonly AudioTrackRef[];
  sampleRate?: number;
  maxSamples?: number;
  signal?: AbortSignal;
}
export interface AudioMixResult {
  range: { startSample: number; endSample: number };
  sampleRate: number;
  channels: [Float32Array, Float32Array];
  peak: number;
  clippedSamples: number;
  conform: AudioConform;
}

export async function mixShotAudio(
  animation: ShotAnimation,
  decode: StudioAudioDecoder,
  input: AudioMixOptions = {},
): Promise<AudioMixResult> {
  const settings = options(input);
  return mix(
    conformShotAudio(animation, settings.sampleRate, {
      rounding: settings.rounding,
      ...(settings.tracks === undefined ? {} : { tracks: settings.tracks }),
    }),
    decode,
    settings,
  );
}
export async function mixEditorialAudio(
  sequence: EditorialSequence,
  animations: readonly ShotAnimation[],
  decode: StudioAudioDecoder,
  input: AudioMixOptions & { transitions: "sum" | "linear" },
): Promise<AudioMixResult> {
  const { transitions, ...rest } = input,
    settings = options(rest);
  return mix(
    conformEditorialAudio(sequence, animations, {
      sampleRate: settings.sampleRate,
      rounding: settings.rounding,
      transitions,
      ...(settings.tracks === undefined ? {} : { tracks: settings.tracks }),
    }),
    decode,
    settings,
  );
}

async function mix(
  conform: AudioConform,
  decode: StudioAudioDecoder,
  settings: ReturnType<typeof options>,
): Promise<AudioMixResult> {
  if (typeof decode !== "function")
    throw new CodeboardError("INVALID_ARGUMENT", "Audio mixing requires a decoder");
  const cancelled = () => {
    if (settings.signal?.aborted) throw new CodeboardError("CANCELLED", "Audio mixing cancelled");
  };
  cancelled();
  const range = settings.range ?? { startSample: 0, endSample: conform.duration.value };
  if (range.endSample <= range.startSample || range.endSample > conform.duration.value)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Audio range must be nonempty and within the timeline",
    );
  const sampleCount = range.endSample - range.startSample;
  const segments = conform.segments.filter(
    (segment) =>
      segment.outputStartSample < range.endSample &&
      segment.outputStartSample + segment.sampleCount > range.startSample,
  );
  if (
    sampleCount > settings.maxSamples ||
    segments.some((segment) => segment.audio.sampleCount.value > settings.maxSamples)
  )
    throw new CodeboardError("RESOURCE_LIMIT", "Audio mix or decoded clip exceeds maxSamples");
  const channels: [Float32Array, Float32Array] = [
    new Float32Array(sampleCount),
    new Float32Array(sampleCount),
  ];
  for (const segment of segments) {
    cancelled();
    const audio = segment.audio,
      source = audio.clip.source;
    const decoded = await decode({
      assetId: audio.clip.assetId,
      sourceSampleRate: source.sampleRate,
      startSample: source.startSample,
      sampleCount: source.sampleCount,
      outputSampleRate: conform.sampleRate,
      outputSampleCount: audio.sampleCount.value,
      ...(settings.signal ? { signal: settings.signal } : {}),
    });
    cancelled();
    if (
      !Array.isArray(decoded) ||
      decoded.length < 1 ||
      decoded.length > 2 ||
      decoded.some(
        (channel) =>
          !(channel instanceof Float32Array) || channel.length !== audio.sampleCount.value,
      )
    )
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Decoder must return mono/stereo Float32 PCM with the requested sample count",
      );
    const first = Math.max(0, range.startSample - segment.outputStartSample);
    const last = Math.min(segment.sampleCount, range.endSample - segment.outputStartSample);
    for (let i = first; i < last; i++) {
      if ((i - first) % 65536 === 0) {
        await setImmediate();
        cancelled();
      }
      const at = segment.outputStartSample + i,
        destination = at - range.startSample,
        offset = segment.clipOffsetSamples + i;
      let gain = audio.clip.volume;
      if (audio.fadeInSamples.value) gain *= Math.min(1, offset / audio.fadeInSamples.value);
      if (audio.fadeOutSamples.value)
        gain *= Math.min(1, (audio.sampleCount.value - 1 - offset) / audio.fadeOutSamples.value);
      for (const ramp of segment.ramps) {
        const t = Math.max(
          0,
          Math.min(1, (at - ramp.startSample) / (ramp.endSample - ramp.startSample)),
        );
        gain *= ramp.from + (ramp.to - ramp.from) * t;
      }
      for (let channel = 0; channel < 2; channel++) {
        const sample = decoded[Math.min(channel, decoded.length - 1)]![offset]!;
        const value = channels[channel]![destination]! + sample * gain;
        if (
          !Number.isFinite(sample) ||
          !Number.isFinite(value) ||
          Math.abs(value) > 3.4028234663852886e38
        )
          throw new CodeboardError("INVALID_ARGUMENT", "Nonfinite or overflowing audio sample");
        channels[channel]![destination] = value;
      }
    }
  }
  let peak = 0,
    clippedSamples = 0;
  for (let i = 0; i < sampleCount; i++) {
    if (i % 65536 === 0) {
      await setImmediate();
      cancelled();
    }
    for (const channel of channels) {
      const level = Math.abs(channel[i]!);
      peak = Math.max(peak, level);
      if (level > 1) clippedSamples++;
    }
  }
  return {
    sampleRate: conform.sampleRate,
    channels,
    peak,
    clippedSamples,
    conform,
    range: { ...range },
  };
}
