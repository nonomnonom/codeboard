import { expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  StoryboardProject,
  exportMovie,
  renderFramePNG,
  decodePixels,
  pathCommands,
} from "../../../src/index.js";
import { ffmpeg } from "./fixture.js";

it("exports editable gradient artwork and animated opacity consistently with preview", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gradient-movie-"));
  try {
    const p = StoryboardProject.create({
      title: "Gradient export",
      width: 96,
      height: 54,
      frameRate: 24,
      background: "white",
    });
    const panel = p.addScene("S").addShot("S").addPanel({ durationFrames: 12 }),
      layer = panel.addVectorLayer("Gradient");
    layer.path(pathCommands("M 0 0 L 96 0 L 96 54 L 0 54 Z"), {
      fill: {
        kind: "linear",
        from: { x: 0, y: 0 },
        to: { x: 96, y: 0 },
        stops: [
          { offset: 0, color: "black" },
          { offset: 1, color: "white" },
        ],
      },
    });
    p.production.addLayerKeyframe(layer.id, 0, { opacity: 1 });
    p.production.addLayerKeyframe(layer.id, 11, { opacity: 0.2 });
    const file = join(directory, "gradient.mp4");
    await exportMovie(p, file, { ffmpegPath: ffmpeg! });
    const decoded = await promisify(execFile)(
      ffmpeg!,
      [
        "-v",
        "error",
        "-i",
        file,
        "-vf",
        "select=eq(n\\,0)+eq(n\\,11)",
        "-fps_mode",
        "passthrough",
        "-pix_fmt",
        "rgba",
        "-f",
        "rawvideo",
        "pipe:1",
      ],
      { encoding: "buffer", maxBuffer: 1024 * 1024 },
    );
    const frameBytes = 96 * 54 * 4;
    expect(decoded.stdout.length).toBe(frameBytes * 2);
    for (const [index, frame] of [0, 11].entries()) {
      const preview = await decodePixels(await renderFramePNG(p, frame));
      for (const x of [12, 36, 60, 84])
        for (let c = 0; c < 3; c++) {
          const at = (27 * 96 + x) * 4 + c;
          expect(
            Math.abs(decoded.stdout[index * frameBytes + at]! - preview.pixels[at]!),
          ).toBeLessThanOrEqual(8);
        }
    }
    expect(
      decoded.stdout[frameBytes + (27 * 96 + 12) * 4]! - decoded.stdout[(27 * 96 + 12) * 4]!,
    ).toBeGreaterThan(150);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
