import type { Point } from "../model/types.js";
import { interpolateRotation, timedPoints } from "./pen-input.js";
import { interpolateNumber as mix } from "./math.js";

export type PointLike = Pick<Point, "x" | "y"> & Partial<Omit<Point, "x" | "y">>;

function mixPoint(a: PointLike, b: PointLike, t: number): Point {
  const rotation = interpolateRotation(a.rotation, b.rotation, t);
  return {
    x: mix(a.x, b.x, t),
    y: mix(a.y, b.y, t),
    pressure: mix(a.pressure ?? 1, b.pressure ?? 1, t),
    time: mix(a.time ?? 0, b.time ?? 0, t),
    tiltX: mix(a.tiltX ?? 0, b.tiltX ?? 0, t),
    tiltY: mix(a.tiltY ?? 0, b.tiltY ?? 0, t),
    ...(rotation === undefined ? {} : { rotation }),
  };
}

export function line(from: PointLike, to: PointLike, samples = 24): Point[] {
  if (!Number.isSafeInteger(samples) || samples < 2)
    throw new Error("line() requires a whole number of at least two samples");
  const [a, b] = timedPoints([from, to], (samples - 1) * 8);
  return Array.from({ length: samples }, (_, i) => mixPoint(a!, b!, i / (samples - 1)));
}

export function cubic(
  p0: PointLike,
  p1: PointLike,
  p2: PointLike,
  p3: PointLike,
  samples = 48,
): Point[] {
  if (!Number.isSafeInteger(samples) || samples < 2)
    throw new Error("cubic() requires a whole number of at least two samples");
  [p0, p1, p2, p3] = timedPoints([p0, p1, p2, p3], ((samples - 1) * 8) / 3) as [
    Point,
    Point,
    Point,
    Point,
  ];
  return Array.from({ length: samples }, (_, i) => {
    const t = i / (samples - 1);
    const a = mixPoint(p0, p1, t);
    const b = mixPoint(p1, p2, t);
    const c = mixPoint(p2, p3, t);
    return mixPoint(mixPoint(a, b, t), mixPoint(b, c, t), t);
  });
}

export function catmullRom(points: PointLike[], samplesPerSegment = 12, tension = 0.5): Point[] {
  if (points.length < 2) throw new Error("catmullRom() requires at least two control points");
  if (!Number.isSafeInteger(samplesPerSegment) || samplesPerSegment < 1)
    throw new Error("catmullRom() requires a positive whole sample count per segment");
  const explicitTime = points.some((p) => p.time !== undefined);
  points = timedPoints(points, samplesPerSegment * 8);
  const result: Point[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    for (let step = 0; step < samplesPerSegment; step += 1) {
      const t = step / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const basis = (v0: number, v1: number, v2: number, v3: number) =>
        (2 * t3 - 3 * t2 + 1) * v1 +
        (t3 - 2 * t2 + t) * tension * (v2 - v0) +
        (-2 * t3 + 3 * t2) * v2 +
        (t3 - t2) * tension * (v3 - v1);
      result.push({
        ...mixPoint(p1, p2, t),
        x: basis(p0.x, p1.x, p2.x, p3.x),
        y: basis(p0.y, p1.y, p2.y, p3.y),
        pressure: Math.max(
          0,
          Math.min(
            1,
            basis(p0.pressure ?? 1, p1.pressure ?? 1, p2.pressure ?? 1, p3.pressure ?? 1),
          ),
        ),
        time: explicitTime ? mix(p1.time!, p2.time!, t) : result.length * 8,
      });
    }
  }
  result.push({ ...points.at(-1)!, time: explicitTime ? points.at(-1)!.time! : result.length * 8 });
  return result;
}

export function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  options: { samples?: number; pressure?: number; rotation?: number } = {},
): Point[] {
  const samples = options.samples ?? 64;
  const angle = options.rotation ?? 0;
  return Array.from({ length: samples + 1 }, (_, i) => {
    const theta = (i / samples) * Math.PI * 2;
    const x = Math.cos(theta) * rx;
    const y = Math.sin(theta) * ry;
    return {
      x: cx + x * Math.cos(angle) - y * Math.sin(angle),
      y: cy + x * Math.sin(angle) + y * Math.cos(angle),
      pressure: options.pressure ?? 1,
      time: i * 8,
    };
  });
}
