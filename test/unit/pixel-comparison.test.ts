import { describe, expect, it } from "vitest";
import { createPixels, comparePixels } from "../../src/drawing/pixel-buffer.js";

describe("visible pixel difference", () => {
  it("rejects malformed storage on either side of the comparison", () => {
    const valid = createPixels(1, 1);
    const truncated = { width: 1, height: 1, pixels: new Uint8Array(3) };
    expect(() => comparePixels(truncated, valid)).toThrow();
    expect(() => comparePixels(valid, truncated)).toThrow();
  });
  it("subtracts visible colors and alpha when both images contain paint", () => {
    const before = { width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 128]) };
    const after = { width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 64]) };
    expect(comparePixels(before, after)).toEqual({
      width: 1,
      height: 1,
      changedPixels: 1,
      maxChannelDelta: 64,
      meanAbsoluteDelta: 32,
      bounds: { x: 0, y: 0, width: 1, height: 1 },
    });
    expect(comparePixels(before, before)).toMatchObject({
      changedPixels: 0,
      meanAbsoluteDelta: 0,
      bounds: null,
    });
  });
  it("ignores hidden RGB beneath fully transparent pixels", () => {
    const before = createPixels(2, 1);
    const after = createPixels(2, 1);
    after.pixels.set([255, 100, 50, 0]);
    expect(comparePixels(before, after)).toEqual({
      width: 2,
      height: 1,
      changedPixels: 0,
      maxChannelDelta: 0,
      meanAbsoluteDelta: 0,
      bounds: null,
    });
  });

  it("measures premultiplied color, alpha and mean error against known channel values", () => {
    const before = createPixels(2, 2);
    const after = createPixels(2, 2);
    after.pixels.set([255, 0, 0, 128], 4);
    // One pixel contributes 128 red + 128 alpha across 16 channel samples.
    expect(comparePixels(before, after)).toEqual({
      width: 2,
      height: 2,
      changedPixels: 1,
      maxChannelDelta: 128,
      meanAbsoluteDelta: 16,
      bounds: { x: 1, y: 0, width: 1, height: 1 },
    });
    expect(before.pixels).toEqual(new Uint8Array(16));
    expect([...after.pixels]).toEqual([0, 0, 0, 0, 255, 0, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("bounds separate changed pixels using their inclusive extrema", () => {
    const before = createPixels(5, 4);
    const after = createPixels(5, 4);
    after.pixels.set([200, 0, 0, 128], (1 * 5 + 2) * 4);
    after.pixels.set([0, 0, 0, 20], (3 * 5 + 4) * 4);
    expect(comparePixels(before, after)).toMatchObject({
      changedPixels: 2,
      bounds: { x: 2, y: 1, width: 3, height: 3 },
    });
    expect(comparePixels(after, before)).toEqual(comparePixels(before, after));
  });

  it.each([
    [127, 1],
    [128, 0],
    [129, 0],
    [255, 0],
  ])("counts only deltas strictly above threshold %i", (threshold, changedPixels) => {
    const before = createPixels(1, 1);
    const after = createPixels(1, 1);
    after.pixels.set([255, 0, 0, 128]);
    expect(comparePixels(before, after, { threshold })).toEqual({
      width: 1,
      height: 1,
      changedPixels,
      maxChannelDelta: 128,
      meanAbsoluteDelta: 64,
      bounds: changedPixels ? { x: 0, y: 0, width: 1, height: 1 } : null,
    });
  });

  it.each([-1, 256, NaN, Infinity])("rejects invalid threshold %s", (threshold) => {
    expect(() => comparePixels(createPixels(1, 1), createPixels(1, 1), { threshold })).toThrow(
      "Comparison threshold must be between 0 and 255",
    );
  });

  it.each([
    [2, 1],
    [1, 2],
  ])("rejects different dimensions %i x %i", (width, height) => {
    expect(() => comparePixels(createPixels(1, 1), createPixels(width!, height!))).toThrow(
      "Pixel comparison requires matching dimensions",
    );
  });
});
