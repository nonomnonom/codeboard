import { Canvas } from "skia-canvas";
import type { prepareTriangleWarp } from "../animation/triangle-warp.js";
import type { CompositionBounds } from "./composition-bounds.js";
import { CodeboardError } from "../model/errors.js";

type Mapping = ReturnType<typeof prepareTriangleWarp>;
const offsets = [
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75],
] as const;
const tileSize = 32;

/** Composite at coverage samples, then resolve once so shared edges never blend twice. */
export function rasterizeMesh(
  source: Canvas,
  mappings: readonly Mapping[],
  bounds: CompositionBounds,
): Canvas {
  let work = 0;
  const triangles = mappings.map((mapping) => {
    const points = mapping.destination.map(({ x, y }) => ({ x: x - bounds.x, y: y - bounds.y }));
    const left = Math.max(0, Math.floor(Math.min(...points.map((point) => point.x))));
    const top = Math.max(0, Math.floor(Math.min(...points.map((point) => point.y))));
    const right = Math.min(bounds.width, Math.ceil(Math.max(...points.map((point) => point.x))));
    const bottom = Math.min(bounds.height, Math.ceil(Math.max(...points.map((point) => point.y))));
    work += Math.max(0, right - left) * Math.max(0, bottom - top) * offsets.length;
    if (!Number.isFinite(work) || work > 268435456)
      throw new CodeboardError(
        "RESOURCE_LIMIT",
        "Mesh rasterization exceeds the coverage sample budget",
        { details: { reason: "MESH_RASTER_WORK", samples: work, maxSamples: 268435456 } },
      );
    const [a, b, c] = points;
    if ((b!.x - a!.x) * (c!.y - a!.y) - (b!.y - a!.y) * (c!.x - a!.x) < 0) points.reverse();
    const edges = points.map((a, index) => {
      const b = points[(index + 1) % 3]!;
      const x = a.y - b.y,
        y = b.x - a.x,
        constant = a.x * b.y - a.y * b.x;
      if (![x, y, constant].every(Number.isFinite))
        throw new CodeboardError("INVALID_ARGUMENT", "Mesh coverage exceeds numerical limits");
      return { x, y, constant, inclusive: b.y < a.y || (b.y === a.y && b.x > a.x) };
    });
    return { ...mapping, left, top, right, bottom, edges };
  });
  const sourceWidth = source.width,
    sourceHeight = source.height;
  const texture = source.getContext("2d").getImageData(0, 0, sourceWidth, sourceHeight).data;
  const output = new Canvas(bounds.width, bounds.height);
  const context = output.getContext("2d");
  try {
    const image = context.createImageData(bounds.width, bounds.height);
    const samples = new Float32Array(tileSize * tileSize * 4 * offsets.length);
    const color = new Float64Array(4);
    for (let top = 0; top < bounds.height; top += tileSize)
      for (let left = 0; left < bounds.width; left += tileSize) {
        samples.fill(0);
        const right = Math.min(bounds.width, left + tileSize),
          bottom = Math.min(bounds.height, top + tileSize);
        for (const triangle of triangles) {
          const x0 = Math.max(left, triangle.left),
            x1 = Math.min(right, triangle.right);
          const y0 = Math.max(top, triangle.top),
            y1 = Math.min(bottom, triangle.bottom);
          if (x0 >= x1 || y0 >= y1) continue;
          const [a, b, c, d, e, f] = triangle.inverse;
          for (let y = y0; y < y1; y++)
            for (let x = x0; x < x1; x++) {
              let coverage = 0;
              for (let sample = 0; sample < offsets.length; sample++) {
                const [dx, dy] = offsets[sample]!;
                if (
                  triangle.edges.every((edge) => {
                    const value = edge.x * (x + dx) + edge.y * (y + dy) + edge.constant;
                    return value > 0 || (value === 0 && edge.inclusive);
                  })
                )
                  coverage |= 1 << sample;
              }
              if (!coverage) continue;
              // Pixel-center shading preserves identity textures; coverage is multisampled.
              const px = x + bounds.x + 0.5,
                py = y + bounds.y + 0.5;
              const tx = Math.max(0, Math.min(sourceWidth - 1, a * px + c * py + e - 0.5));
              const ty = Math.max(0, Math.min(sourceHeight - 1, b * px + d * py + f - 0.5));
              if (!Number.isFinite(tx) || !Number.isFinite(ty))
                throw new CodeboardError(
                  "INVALID_ARGUMENT",
                  "Mesh texture lookup exceeds numerical limits",
                );
              const ix = Math.floor(tx),
                iy = Math.floor(ty),
                fx = tx - ix,
                fy = ty - iy;
              color.fill(0);
              for (let dy = 0; dy < 2; dy++)
                for (let dx = 0; dx < 2; dx++) {
                  const index =
                    (Math.min(sourceHeight - 1, iy + dy) * sourceWidth +
                      Math.min(sourceWidth - 1, ix + dx)) *
                    4;
                  const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
                  const alpha = (texture[index + 3]! / 255) * weight;
                  for (let channel = 0; channel < 3; channel++)
                    color[channel]! += (texture[index + channel]! / 255) * alpha;
                  color[3]! += alpha;
                }
              const start = ((y - top) * tileSize + x - left) * 16;
              for (let sample = 0; sample < offsets.length; sample++) {
                if (!(coverage & (1 << sample))) continue;
                const index = start + sample * 4;
                for (let channel = 0; channel < 4; channel++)
                  samples[index + channel] =
                    color[channel]! + samples[index + channel]! * (1 - color[3]!);
              }
            }
        }
        for (let y = top; y < bottom; y++)
          for (let x = left; x < right; x++) {
            const start = ((y - top) * tileSize + x - left) * 16;
            color.fill(0);
            for (let sample = 0; sample < offsets.length; sample++)
              for (let channel = 0; channel < 4; channel++)
                color[channel]! += samples[start + sample * 4 + channel]! / offsets.length;
            const index = (y * bounds.width + x) * 4;
            for (let channel = 0; channel < 3; channel++)
              image.data[index + channel] = color[3]
                ? Math.round((color[channel]! / color[3]!) * 255)
                : 0;
            image.data[index + 3] = Math.round(color[3]! * 255);
          }
      }
    context.putImageData(image, 0, 0);
    return output;
  } catch (error) {
    context.reset();
    throw error;
  }
}
