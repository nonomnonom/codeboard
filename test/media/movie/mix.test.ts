import { expect, it } from "vitest";
import { mkdtemp, rm, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { StoryboardProject, createToneWav, exportMovie } from "../../../src/index.js";
import { ffmpeg } from "./fixture.js";

it("encodes real video and trimmed, placed, faded audio", async () => {
  const directory = await mkdtemp(join(tmpdir(), "board-movie-"));
  try {
    const p = StoryboardProject.create({
      title: "Movie integration",
      width: 96,
      height: 54,
      frameRate: 24,
    });
    const panel = p.addScene("S").addShot("S").addPanel({ durationFrames: 12 });
    panel.addVectorLayer("Art").text("test", 10, 30, { font: "12px sans-serif" });
    await writeFile(
      join(directory, "tone.wav"),
      createToneWav({ durationSeconds: 1, volume: 0.6, attackSeconds: 0, releaseSeconds: 0 }),
    );
    const asset = p.production.addAsset({
      kind: "audio",
      name: "tone",
      path: "tone.wav",
      mimeType: "audio/wav",
      source: "managed",
    });
    const track = p.production.addAudioTrack("sound");
    p.production.addAudioClip(track, {
      assetId: asset,
      name: "trimmed tone",
      startFrame: 6,
      sourceInFrame: 3,
      durationFrames: 6,
      volume: 0.5,
      fadeInFrames: 1,
      fadeOutFrames: 1,
    });
    const projectFile = join(directory, "project.cboard");
    await p.save(projectFile);
    await unlink(join(directory, "tone.wav"));
    const reopened = await StoryboardProject.open(projectFile);
    const file = join(directory, "movie.mp4"),
      result = await exportMovie(reopened, file, { ffmpegPath: ffmpeg! });
    expect(result.frames).toBe(12);
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
    expect(rms(1000, 9000)).toBeLessThan(0.002);
    expect(rms(15000, 19500)).toBeGreaterThan(0.1);
    const destination = reopened.production.addAudioTrack("Final effects");
    const clip = reopened.production.audioClips(track)[0]!;
    reopened.production.moveAudioClip(clip.id, destination);
    const movedFile = join(directory, "moved.mp4");
    await exportMovie(reopened, movedFile, { ffmpegPath: ffmpeg! });
    const moved = await promisify(execFile)(
      ffmpeg!,
      [
        "-v",
        "error",
        "-i",
        movedFile,
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
    expect(moved.stdout.equals(stdout)).toBe(true);
    reopened.production.splitAudioClip(clip.id, 9);
    const splitFile = join(directory, "split.mp4");
    await exportMovie(reopened, splitFile, { ffmpegPath: ffmpeg! });
    const split = await promisify(execFile)(
      ffmpeg!,
      [
        "-v",
        "error",
        "-i",
        splitFile,
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
    expect(split.stdout.equals(stdout)).toBe(true);
    const verify = await promisify(execFile)(
      ffmpeg!,
      ["-v", "error", "-i", file, "-map", "0:v:0", "-f", "null", "-"],
      { encoding: "utf8" },
    );
    expect(verify.stderr).toBe("");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
