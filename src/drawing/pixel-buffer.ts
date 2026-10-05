import type { PixelBuffer, PixelRegion } from "../model/types.js";
import {
  validateDimensions,
  validatePixels,
  validatePixelRegion,
} from "../model/validation/pixels.js";

export function createPixels(width: number, height: number): PixelBuffer {
  // Validate dimensions before allocating user-controlled memory.
  validateDimensions(width, height);
  return { width, height, pixels: new Uint8Array(width * height * 4) };
}

export function readPixelRegion(image: PixelBuffer, region: PixelRegion): PixelBuffer {
  validatePixelRegion(image, region);
  const result = createPixels(region.width, region.height);
  for (let row = 0; row < region.height; row++) {
    const start = ((region.y + row) * image.width + region.x) * 4;
    result.pixels.set(
      image.pixels.subarray(start, start + region.width * 4),
      row * region.width * 4,
    );
  }
  return result;
}

export function writePixelRegion(
  image: PixelBuffer,
  x: number,
  y: number,
  patch: PixelBuffer,
): void {
  validatePixels(patch);
  validatePixelRegion(image, { x, y, width: patch.width, height: patch.height });
  const bytes = patch.pixels.slice();
  for (let row = 0; row < patch.height; row++)
    image.pixels.set(
      bytes.subarray(row * patch.width * 4, (row + 1) * patch.width * 4),
      ((y + row) * image.width + x) * 4,
    );
}

export interface PixelComparison {
  width: number;
  height: number;
  changedPixels: number;
  maxChannelDelta: number;
  meanAbsoluteDelta: number;
  bounds: PixelRegion | null;
}

/** Compare visible premultiplied RGBA, ignoring hidden RGB under zero alpha. */
export function comparePixels(
  before: PixelBuffer,
  after: PixelBuffer,
  options: { threshold?: number } = {},
): PixelComparison {
  validatePixels(before);
  validatePixels(after);
  if (before.width !== after.width || before.height !== after.height)
    throw new Error("Pixel comparison requires matching dimensions");
  const threshold = options.threshold ?? 0;
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 255)
    throw new Error("Comparison threshold must be between 0 and 255");
  const { width, height } = before;
  let changedPixels = 0,
    maxChannelDelta = 0,
    total = 0,
    left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let i = 0; i < width * height; i++) {
    const at = i * 4,
      aa = before.pixels[at + 3]!,
      ba = after.pixels[at + 3]!;
    let difference = Math.abs(aa - ba);
    total += difference;
    for (let c = 0; c < 3; c++) {
      const delta = Math.abs(
        (before.pixels[at + c]! * aa) / 255 - (after.pixels[at + c]! * ba) / 255,
      );
      total += delta;
      difference = Math.max(difference, delta);
    }
    maxChannelDelta = Math.max(maxChannelDelta, difference);
    if (difference > threshold) {
      const x = i % width,
        y = Math.floor(i / width);
      changedPixels++;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return {
    width,
    height,
    changedPixels,
    maxChannelDelta,
    meanAbsoluteDelta: total / (width * height * 4),
    bounds: changedPixels
      ? { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
      : null,
  };
}
