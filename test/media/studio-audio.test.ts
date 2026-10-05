import { expect, it } from "vitest";
import {
  defineShotAnimation,
  encodeWav,
  createFFmpegAudioDecoder,
  mixShotAudio,
  type ShotAnimation,
} from "../../src/index.js";

const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH ?? "ffprobe";

function animation(): ShotAnimation {
  return defineShotAnimation({
    id: "animation",
    shotId: "shot",
    name: "Audio timing",
    frameRate: { numerator: 24, denominator: 1 },
    durationFrames: 24,
    canvas: { width: 32, height: 32, background: "white" },
    layers: [],
    cameraKeyframes: [],
    audio: [
      {
        id: "track",
        name: "Cue",
        muted: false,
        clips: [
          {
            id: "clip",
            assetId: "cue",
            name: "Trimmed samples",
            start: { ticks: 6, rate: { numerator: 24, denominator: 1 } },
            source: { sampleRate: 48000, startSample: 2400, sampleCount: 12000 },
            volume: 0.5,
            fadeInSamples: 0,
            fadeOutSamples: 0,
          },
        ],
      },
    ],
  });
}

it("rejects oversized, cancelled and malformed mixes before publishing samples", async () => {
  const source = animation();
  let calls = 0;
  const decode = async () => {
    calls++;
    return [new Float32Array(1)];
  };
  await expect(mixShotAudio(source, decode, { maxSamples: 100 })).rejects.toMatchObject({
    code: "RESOURCE_LIMIT",
  });
  const controller = new AbortController();
  controller.abort();
  await expect(mixShotAudio(source, decode, { signal: controller.signal })).rejects.toMatchObject({
    code: "CANCELLED",
  });
  expect(calls).toBe(0);
  await expect(mixShotAudio(source, decode)).rejects.toThrow();
});

it("decodes real WAV source trim and places stereo samples at the exact timeline offset", async () => {
  const samples = new Float32Array(48000);
  // Distinct regions detect both source trim and timeline placement errors.
  samples.fill(-0.5, 0, 2400);
  samples.fill(0.25, 2400, 14400);
  samples.fill(0.75, 14400);
  const wav = encodeWav([samples], 48000);
  const decode = createFFmpegAudioDecoder(() => wav, {
    ffmpegPath: ffmpeg,
    ffprobePath: ffprobe,
  });
  const mixed = await mixShotAudio(animation(), decode);
  const expected = (Math.round(0.25 * 32767) / 32768) * 0.5;
  expect(mixed.channels[0]).toHaveLength(48000);
  expect(mixed.channels[1]).toEqual(mixed.channels[0]);
  for (const channel of mixed.channels) {
    expect(channel.subarray(0, 12000).every((sample) => sample === 0)).toBe(true);
    expect(channel.subarray(12000, 24000).every((sample) => sample === expected)).toBe(true);
    expect(channel.subarray(24000).every((sample) => sample === 0)).toBe(true);
  }
  expect(mixed.clippedSamples).toBe(0);
});

it("rejects changed media, incorrect sample rate and out-of-bounds source ranges", async () => {
  let wav = encodeWav([new Float32Array(4800).fill(0.25)], 48000);
  const decode = createFFmpegAudioDecoder(() => wav, {
    ffmpegPath: ffmpeg,
    ffprobePath: ffprobe,
  });
  const request = {
    assetId: "cue",
    sourceSampleRate: 48000,
    startSample: 0,
    sampleCount: 4800,
    outputSampleRate: 48000,
    outputSampleCount: 4800,
  };
  await decode(request);
  await expect(decode({ ...request, startSample: 1 })).rejects.toMatchObject({
    code: "INVALID_ARGUMENT",
  });
  await expect(
    decode({ ...request, sourceSampleRate: 24000, outputSampleRate: 24000 }),
  ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  wav = encodeWav([new Float32Array(4800).fill(0.5)], 48000);
  await expect(decode(request)).rejects.toMatchObject({ code: "ASSET_CHECKSUM_MISMATCH" });
});
