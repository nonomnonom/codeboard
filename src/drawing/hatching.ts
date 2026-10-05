import type { Point } from "../model/types.js";
import { line, type PointLike } from "./curve-sampling.js";

export function hatchPolygon(
  polygon: PointLike[],
  options: {
    angle?: number;
    spacing?: number;
    pressure?: number;
    jitter?: number;
    seed?: number;
    maxSamples?: number;
  } = {},
): Point[][] {
  if (polygon.length < 3)
    throw new Error("hatchPolygon() requires a polygon with at least three points");
  const angle = options.angle ?? -Math.PI / 4;
  const spacing = options.spacing ?? 10;
  if (!Number.isFinite(spacing) || spacing <= 0)
    throw new Error("Hatching spacing must be positive and finite");
  const maxSamples = options.maxSamples ?? 1_000_000;
  if (!Number.isSafeInteger(maxSamples) || maxSamples < 2)
    throw new Error("Hatching maxSamples must be a whole number of at least two");
  if (
    !Number.isFinite(angle) ||
    !polygon.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
  )
    throw new Error("Hatching coordinates and angle must be finite");
  if (
    !Number.isFinite(options.pressure ?? 0.5) ||
    (options.pressure ?? 0.5) < 0 ||
    (options.pressure ?? 0.5) > 1
  )
    throw new Error("Hatching pressure must be between zero and one");
  if (!Number.isFinite(options.jitter ?? 0) || (options.jitter ?? 0) < 0)
    throw new Error("Hatching jitter must be nonnegative and finite");
  if (!Number.isSafeInteger(options.seed ?? 1))
    throw new Error("Hatching seed must be a safe integer");
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const rotated = polygon.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }));
  let minY = Infinity,
    maxY = -Infinity;
  for (const p of rotated) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y))
      throw new Error("Hatching rotated coordinates exceed the supported numerical range");
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const rows = Math.floor((maxY - minY) / spacing) + 1;
  if (!Number.isSafeInteger(rows) || rows > maxSamples)
    throw new Error(
      `Hatching scan rows exceed maxSamples ${maxSamples}; increase the explicit budget or spacing`,
    );
  if (rows > 1 && (minY + spacing === minY || maxY - spacing === maxY))
    throw new Error(
      "Hatching spacing is below coordinate precision; translate the polygon closer to the origin",
    );
  const lines: Point[][] = [];
  let state = options.seed ?? 1;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  let totalSamples = 0;
  for (let row = 0; row < rows; row++) {
    const y = minY + row * spacing;
    const intersections: number[] = [];
    for (let i = 0; i < rotated.length; i += 1) {
      const a = rotated[i]!;
      const b = rotated[(i + 1) % rotated.length]!;
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        const t = (y - a.y) / (b.y - a.y),
          x = (1 - t) * a.x + t * b.x;
        if (!Number.isFinite(t) || !Number.isFinite(x))
          throw new Error("Hatching intersection exceeds the supported numerical range");
        intersections.push(x);
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const jitter = (random() - 0.5) * (options.jitter ?? 0);
      const a = { x: intersections[i]! + jitter, y };
      const b = { x: intersections[i + 1]! + jitter, y };
      const unrotate = (p: { x: number; y: number }): Point => ({
        x: p.x * cos + p.y * sin,
        y: -p.x * sin + p.y * cos,
        pressure: options.pressure ?? 0.5,
      });
      const samples = Math.max(2, Math.ceil((b.x - a.x) / 8));
      totalSamples += samples;
      if (!Number.isSafeInteger(totalSamples) || totalSamples > maxSamples)
        throw new Error(
          `Hatching samples exceed maxSamples ${maxSamples}; increase the explicit budget or spacing`,
        );
      const from = unrotate(a),
        to = unrotate(b);
      if (![from.x, from.y, to.x, to.y].every(Number.isFinite))
        throw new Error("Hatching result exceeds the supported numerical range");
      lines.push(line(from, to, samples));
    }
  }
  return lines;
}
