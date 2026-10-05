import { describe, expect, it } from "vitest";
import { createPixels, readPixelRegion, writePixelRegion } from "../../src/drawing/pixel-buffer.js";

const image = () => ({
  width: 3,
  height: 2,
  pixels: new Uint8Array([
    1, 2, 3, 255, 4, 5, 6, 128, 7, 8, 9, 0, 10, 11, 12, 255, 13, 14, 15, 128, 16, 17, 18, 0,
  ]),
});

describe("pixel allocation", () => {
  it("allocates independent zero-filled RGBA storage", () => {
    const first = createPixels(3, 2);
    const second = createPixels(3, 2);
    expect(first).toEqual({ width: 3, height: 2, pixels: new Uint8Array(24) });
    first.pixels[0] = 255;
    expect(second.pixels[0]).toBe(0);
  });

  it.each([
    [0, 1],
    [-1, 1],
    [1, 0],
    [1.5, 2],
    [NaN, 1],
    [Infinity, 1],
    [Number.MAX_SAFE_INTEGER, 2],
  ])("rejects invalid dimensions %s x %s before allocation", (width, height) => {
    expect(() => createPixels(width!, height!)).toThrow();
  });
});

describe("region reads", () => {
  it("reads each row of a non-origin rectangle in row-major RGBA order", () => {
    expect(readPixelRegion(image(), { x: 1, y: 0, width: 2, height: 2 })).toEqual({
      width: 2,
      height: 2,
      pixels: new Uint8Array([4, 5, 6, 128, 7, 8, 9, 0, 13, 14, 15, 128, 16, 17, 18, 0]),
    });
  });

  it("reads the last pixel and returns a detached buffer", () => {
    const source = image();
    const region = readPixelRegion(source, { x: 2, y: 1, width: 1, height: 1 });
    expect([...region.pixels]).toEqual([16, 17, 18, 0]);
    region.pixels[0] = 99;
    expect(source.pixels[20]).toBe(16);
  });

  it.each([
    { x: -1, y: 0, width: 1, height: 1 },
    { x: 0, y: -1, width: 1, height: 1 },
    { x: 2, y: 0, width: 2, height: 1 },
    { x: 0, y: 1, width: 1, height: 2 },
  ])("rejects an out-of-bounds read %j", (region) => {
    expect(() => readPixelRegion(image(), region)).toThrow();
  });
});

describe("region writes", () => {
  it("rejects a truncated patch without changing the destination", () => {
    const target = image();
    expect(() =>
      writePixelRegion(target, 0, 0, { width: 1, height: 1, pixels: new Uint8Array(3) }),
    ).toThrow();
    expect(target).toEqual(image());
  });
  it("copies a two-column patch across multiple rows", () => {
    const target = image();
    writePixelRegion(target, 1, 0, {
      width: 2,
      height: 2,
      pixels: new Uint8Array([21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33, 34, 35, 36, 37, 38]),
    });
    expect([...target.pixels]).toEqual([
      1, 2, 3, 255, 21, 22, 23, 24, 25, 26, 27, 28, 10, 11, 12, 255, 31, 32, 33, 34, 35, 36, 37, 38,
    ]);
  });
  it("writes the target rectangle and retains all surrounding channel bytes", () => {
    const target = image();
    const patch = { width: 1, height: 2, pixels: new Uint8Array([90, 91, 92, 93, 94, 95, 96, 97]) };
    writePixelRegion(target, 1, 0, patch);
    expect([...target.pixels]).toEqual([
      1, 2, 3, 255, 90, 91, 92, 93, 7, 8, 9, 0, 10, 11, 12, 255, 94, 95, 96, 97, 16, 17, 18, 0,
    ]);
    patch.pixels[0] = 0;
    expect(target.pixels[4]).toBe(90);
  });

  it("copies an overlapping source before replacing destination rows", () => {
    const target = {
      width: 1,
      height: 3,
      pixels: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
    };
    writePixelRegion(target, 0, 1, { width: 1, height: 2, pixels: target.pixels.subarray(0, 8) });
    expect([...target.pixels]).toEqual([1, 2, 3, 4, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("rejects an oversized patch without changing destination bytes", () => {
    const target = image();
    expect(() => writePixelRegion(target, 2, 1, createPixels(2, 1))).toThrow();
    expect(target).toEqual(image());
  });
});
