import { afterEach, expect, it, vi } from "vitest";
afterEach(() => vi.restoreAllMocks());

import sharp from "sharp";
import {
  StoryboardProject,
  renderFrameSheet,
  renderFramePNG,
  pathCommands,
} from "../../../src/index.js";

it("reviews caller-ordered timeline frames with exposure changes, transitions and repeated frames without full snapshots", async () => {
  const p = StoryboardProject.create({ title: "Frame review", width: 80, height: 40 });
  const scene = p.addScene("S"),
    first = scene.addShot("A").addPanel({ durationFrames: 6 }),
    next = scene.addShot("B").addPanel({ durationFrames: 4 });
  const track = first.addGroup("Poses"),
    a = first.addVectorLayer("A", {}, track.id),
    b = first.addVectorLayer("B", {}, track.id);
  for (const [layer, color] of [
    [a, "red"],
    [b, "blue"],
    [next.addVectorLayer("Next"), "green"],
  ] as const)
    layer.path(pathCommands("M 0 0 L 80 0 L 80 40 L 0 40 Z"), { fill: color });
  p.production.setDrawingSequence(track.id, [
    { frame: 0, drawingId: a.id },
    { frame: 2, drawingId: b.id },
  ]);
  p.production.setTransition(first.id, { type: "dissolve", durationFrames: 2 });
  const before = p.toJSON(),
    frames = [0, 2, 4, 6, 0],
    expected = [];
  for (const frame of frames)
    expected.push(
      await sharp(await renderFramePNG(p, frame))
        .ensureAlpha()
        .raw()
        .toBuffer(),
    );
  const spy = vi.spyOn(p, "toJSON").mockImplementation(() => {
    throw new Error("Full snapshot");
  });
  let png: Buffer;
  try {
    png = await renderFrameSheet(p, frames, { columns: 3, thumbnailWidth: 80 });
  } finally {
    spy.mockRestore();
  }
  for (const [index, pixels] of expected.entries()) {
    const actual = await sharp(png!)
      .extract({
        left: 16 + (index % 3) * 96,
        top: 16 + Math.floor(index / 3) * 84,
        width: 80,
        height: 40,
      })
      .ensureAlpha()
      .raw()
      .toBuffer();
    expect(actual.equals(pixels)).toBe(true);
  }
  expect(p.toJSON()).toEqual(before);
});

it("rejects malformed or unavailable review frames and oversized output without changing the project", async () => {
  const p = StoryboardProject.create({ title: "Bounds", width: 80, height: 40 });
  p.addScene("S").addShot("A").addPanel({ durationFrames: 4 });
  const before = p.toJSON();
  for (const frames of [[], [-1], [0.5], [4], [0, 4], [NaN]])
    await expect(renderFrameSheet(p, frames)).rejects.toThrow();
  await expect(renderFrameSheet(p, [0], { columns: 0 })).rejects.toThrow(/columns/);
  await expect(
    renderFrameSheet(p, Array(200).fill(0), { thumbnailWidth: 1920 }),
  ).rejects.toMatchObject({
    code: "RESOURCE_LIMIT",
    details: { reason: "SURFACE_PIXEL_LIMIT", maxPixels: 32 * 1024 * 1024 },
  });
  expect(p.toJSON()).toEqual(before);
});
