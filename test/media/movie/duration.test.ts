import { expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { StoryboardProject, createToneWav, exportMovie } from "../../../src/index.js";
import { ffmpeg } from "./fixture.js";

it("keeps timeline duration when audio ends early or a trim begins beyond its source", async () => {
  const directory = await mkdtemp(join(tmpdir(), "board-short-audio-"));
  try {
    const p = StoryboardProject.create({
      title: "Short source",
      width: 64,
      height: 64,
      frameRate: 24,
    });
    p.addScene("S").addShot("S").addPanel({ durationFrames: 24 });
    await writeFile(
      join(directory, "short.wav"),
      createToneWav({ durationSeconds: 0.125, volume: 0.5, attackSeconds: 0, releaseSeconds: 0 }),
    );
    const asset = p.production.addAsset({
      name: "Short tone",
      kind: "audio",
      path: "short.wav",
      source: "managed",
      mimeType: "audio/wav",
    });
    const track = p.production.addAudioTrack("Sound");
    p.production.addAudioClip(track, {
      assetId: asset,
      name: "Short source in long clip",
      startFrame: 6,
      sourceInFrame: 0,
      durationFrames: 18,
      volume: 1,
      fadeInFrames: 0,
      fadeOutFrames: 2,
    });
    p.production.addAudioClip(track, {
      assetId: asset,
      name: "Trim beyond EOF",
      startFrame: 18,
      sourceInFrame: 12,
      durationFrames: 6,
      volume: 1,
      fadeInFrames: 0,
      fadeOutFrames: 0,
    });
    const file = join(directory, "movie.mp4");
    const result = await exportMovie(p, file, { assetRoot: directory, ffmpegPath: ffmpeg! });
    expect(result.frames).toBe(24);
    expect(result.seconds).toBe(1);
    const { stdout } = await promisify(execFile)(
      ffmpeg!,
      [
        "-v",
        "error",
        "-i",
        file,
        "-map",
        "0:a:0",
        "-f",
        "f32le",
        "-ac",
        "1",
        "-ar",
        "48000",
        "pipe:1",
      ],
      { encoding: "buffer", maxBuffer: 1024 * 1024 },
    );
    const rms = (from: number, to: number) => {
      let sum = 0;
      for (let i = from; i < to; i++) sum += stdout.readFloatLE(i * 4) ** 2;
      return Math.sqrt(sum / (to - from));
    };
    expect(stdout.length / 4).toBeGreaterThanOrEqual(48000);
    expect(rms(1000, 9000)).toBeLessThan(0.002);
    expect(rms(13500, 16500)).toBeGreaterThan(0.2);
    expect(rms(21000, 46000)).toBeLessThan(0.002);
    const frames = await promisify(execFile)(
      ffmpeg!,
      ["-v", "error", "-i", file, "-map", "0:v:0", "-f", "framemd5", "-"],
      { encoding: "utf8" },
    );
    expect(frames.stdout.split(/\r?\n/).filter((line) => line.startsWith("0,"))).toHaveLength(24);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
