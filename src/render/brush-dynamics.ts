import type { BrushPreset, Point, RasterStroke } from "../model/types.js";
import { interpolateRotation } from "../drawing/pen-input.js";

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pointSpeed(a: Point, b: Point): number {
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  const elapsed = Math.max(1, (b.time ?? 8) - (a.time ?? 0));
  return clamp(distance / elapsed / 2);
}

export interface Dab extends Point {
  progress: number;
  speed: number;
  direction: number;
}

/** Conservative support for rotated tip corners, speed growth, grains and positional jitter. */
export function brushPadding(brush: BrushPreset): number {
  const aspect =
    brush.tip.kind === "bitmap" ? brush.tip.height / brush.tip.width : brush.tip.aspect;
  const radius = brush.size * 0.5 * (1 + Math.max(0, brush.dynamics.speedSize));
  const extent = Math.max(Math.hypot(1, aspect), 1.04 * Math.max(1, aspect));
  return Math.max(brush.size * 2, radius * (extent + 0.12) + 2);
}

export function sampleDabs(stroke: RasterStroke): Dab[] {
  if (stroke.points.length === 1)
    return [{ ...stroke.points[0]!, progress: 0.5, speed: 0, direction: 0 }];
  const lengths: number[] = [0];
  let total = 0;
  for (let i = 1; i < stroke.points.length; i += 1) {
    total += Math.hypot(
      stroke.points[i]!.x - stroke.points[i - 1]!.x,
      stroke.points[i]!.y - stroke.points[i - 1]!.y,
    );
    lengths.push(total);
  }
  if (total === 0) return [{ ...stroke.points.at(-1)!, progress: 0.5, speed: 0, direction: 0 }];
  const dabs: Dab[] = [];
  let segment = 1;
  let target = 0;
  while (target <= total + 0.001) {
    const progress = total === 0 ? 0 : target / total;
    while (segment < lengths.length - 1 && lengths[segment]! < target) segment += 1;
    const a = stroke.points[segment - 1]!;
    const b = stroke.points[segment]!;
    const span = Math.max(0.0001, lengths[segment]! - lengths[segment - 1]!);
    const t = clamp((target - lengths[segment - 1]!) / span);
    const rotation = interpolateRotation(a.rotation, b.rotation, t);
    const mix = (av: number | undefined, bv: number | undefined, fallback: number) =>
      (av ?? fallback) + ((bv ?? fallback) - (av ?? fallback)) * t;
    dabs.push({
      x: mix(a.x, b.x, 0),
      y: mix(a.y, b.y, 0),
      pressure: mix(a.pressure, b.pressure, 1),
      time: mix(a.time, b.time, 0),
      tiltX: mix(a.tiltX, b.tiltX, 0),
      tiltY: mix(a.tiltY, b.tiltY, 0),
      ...(rotation === undefined ? {} : { rotation }),
      progress,
      speed: pointSpeed(a, b),
      direction: Math.atan2(b.y - a.y, b.x - a.x),
    });
    const pressure = clamp(dabs.at(-1)!.pressure ?? 1);
    const pressureSpacing = 1 + (1 - pressure) * stroke.brush.dynamics.pressureSpacing * 2;
    target += Math.max(
      0.35,
      stroke.brush.size * stroke.brush.spacing * Math.max(0.15, pressureSpacing),
    );
  }
  if (dabs.at(-1)!.progress < 0.999) {
    const last = stroke.points.at(-1)!;
    const previous = stroke.points.at(-2)!;
    dabs.push({
      ...last,
      progress: 1,
      speed: pointSpeed(previous, last),
      direction: Math.atan2(last.y - previous.y, last.x - previous.x),
    });
  }
  return dabs;
}

export function taper(progress: number, start: number, end: number): number {
  const fromStart = start > 0 ? clamp(progress / start) : 1;
  const fromEnd = end > 0 ? clamp((1 - progress) / end) : 1;
  return Math.min(fromStart, fromEnd);
}
