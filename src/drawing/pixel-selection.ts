import sharp from "sharp";
import { Canvas } from "skia-canvas";
import type { PixelBuffer, Point, PixelSelection } from "../model/types.js";
import {
  validateDimensions,
  validatePixels,
  validateSelection,
} from "../model/validation/pixels.js";
export type { PixelSelection } from "../model/types.js";
export { validateSelection } from "../model/validation/pixels.js";

export function polygonPixelSelection(
  width: number,
  height: number,
  points: Pick<Point, "x" | "y">[],
  fillRule: "nonzero" | "evenodd" = "nonzero",
): PixelSelection {
  validateDimensions(width, height);
  if (points.length < 3 || points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
    throw new Error("A polygon selection requires at least three finite points");
  if (fillRule !== "nonzero" && fillRule !== "evenodd")
    throw new Error("Unknown selection fill rule");
  const ctx = new Canvas(width, height).getContext("2d");
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill(fillRule);
  const data = ctx.getImageData(0, 0, width, height).data,
    coverage = new Uint8Array(width * height);
  for (let i = 0; i < coverage.length; i++) coverage[i] = data[i * 4 + 3]!;
  return { width, height, coverage };
}

/** Four-connected flood or all matching pixels, measured in premultiplied RGBA byte units. */
export function colorPixelSelection(
  image: PixelBuffer,
  x: number,
  y: number,
  options: { tolerance?: number; contiguous?: boolean } = {},
): PixelSelection {
  validatePixels(image);
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= image.width ||
    y >= image.height
  )
    throw new Error("Selection seed must be inside the source surface");
  const tolerance = options.tolerance ?? 0;
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 255)
    throw new Error("Selection tolerance must be between 0 and 255");
  const { width, height, pixels } = image,
    seed = y * width + x,
    coverage = new Uint8Array(width * height),
    offset = seed * 4,
    alpha = pixels[offset + 3]!;
  const target = [
    (pixels[offset]! * alpha) / 255,
    (pixels[offset + 1]! * alpha) / 255,
    (pixels[offset + 2]! * alpha) / 255,
    alpha,
  ];
  const matches = (index: number) => {
    const at = index * 4,
      a = pixels[at + 3]!;
    if (Math.abs(a - target[3]!) > tolerance) return false;
    for (let c = 0; c < 3; c++)
      if (Math.abs((pixels[at + c]! * a) / 255 - target[c]!) > tolerance) return false;
    return true;
  };
  if (options.contiguous === false) {
    for (let i = 0; i < coverage.length; i++) if (matches(i)) coverage[i] = 255;
  } else {
    // Mark on insertion so each pixel can enter this bounded queue only once.
    const queue = new Uint32Array(width * height);
    let head = 0,
      tail = 1;
    queue[0] = seed;
    coverage[seed] = 255;
    const add = (index: number) => {
      if (!coverage[index] && matches(index)) {
        coverage[index] = 255;
        queue[tail++] = index;
      }
    };
    while (head < tail) {
      const index = queue[head++]!,
        column = index % width;
      if (column > 0) add(index - 1);
      if (column + 1 < width) add(index + 1);
      if (index >= width) add(index - width);
      if (index + width < coverage.length) add(index + width);
    }
  }
  return { width, height, coverage };
}

export function combinePixelSelections(
  a: PixelSelection,
  b: PixelSelection,
  operation: "union" | "intersect" | "subtract",
): PixelSelection {
  validateSelection(a);
  validateSelection(b, a.width, a.height);
  if (!["union", "intersect", "subtract"].includes(operation))
    throw new Error("Unknown selection combination");
  const coverage = new Uint8Array(a.coverage.length);
  for (let i = 0; i < coverage.length; i++)
    coverage[i] =
      operation === "union"
        ? Math.max(a.coverage[i]!, b.coverage[i]!)
        : operation === "intersect"
          ? Math.min(a.coverage[i]!, b.coverage[i]!)
          : Math.max(0, a.coverage[i]! - b.coverage[i]!);
  return { width: a.width, height: a.height, coverage };
}

export function invertPixelSelection(selection: PixelSelection): PixelSelection {
  validateSelection(selection);
  return { ...selection, coverage: selection.coverage.map((value) => 255 - value) };
}

/** Gaussian coverage feathering in source-pixel units; boundary samples repeat edge coverage. */
export async function featherPixelSelection(
  selection: PixelSelection,
  sigma: number,
): Promise<PixelSelection> {
  validateSelection(selection);
  if (!Number.isFinite(sigma) || (sigma !== 0 && (sigma < 0.3 || sigma > 1000)))
    throw new Error("Selection feather sigma must be 0 or between 0.3 and 1000 source pixels");
  const { width, height } = selection,
    coverage = selection.coverage.slice();
  if (sigma === 0) return { width, height, coverage };
  const result = await sharp(coverage, { raw: { width, height, channels: 1 } })
    .blur({ sigma, precision: "float", minAmplitude: 0.01 })
    .toColourspace("b-w")
    .raw()
    .toBuffer();
  return { width, height, coverage: new Uint8Array(result) };
}
