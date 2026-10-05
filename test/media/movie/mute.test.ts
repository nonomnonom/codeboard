import { expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { StoryboardProject, exportMovie } from "../../../src/index.js";
import { ffmpeg } from "./fixture.js";

it("exports a muted track without reading its unavailable source", async () => {
  const directory = await mkdtemp(join(tmpdir(), "muted-track-"));
  try {
    const p = StoryboardProject.create({ title: "Muted export", width: 32, height: 32 });
    p.addScene("S").addShot("S").addPanel({ durationFrames: 4 });
    const asset = p.production.addAsset({
      name: "Unavailable scratch",
      kind: "audio",
      path: "missing.wav",
      source: "linked",
      mimeType: "audio/wav",
    });
    const track = p.production.addAudioTrack("Scratch");
    p.production.addAudioClip(track, {
      assetId: asset,
      name: "Scratch",
      startFrame: 0,
      sourceInFrame: 0,
      durationFrames: 4,
      volume: 1,
      fadeInFrames: 0,
      fadeOutFrames: 0,
    });
    p.production.updateAudioTrack(track, { muted: true });
    const file = join(directory, "muted.mp4");
    expect((await exportMovie(p, file, { assetRoot: directory, ffmpegPath: ffmpeg! })).frames).toBe(
      4,
    );
    const decoded = await promisify(execFile)(ffmpeg!, [
      "-hide_banner",
      "-i",
      file,
      "-f",
      "null",
      "-",
    ]);
    expect(decoded.stderr).not.toMatch(/Audio:/);
    expect(decoded.stderr).toMatch(/Video:/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
