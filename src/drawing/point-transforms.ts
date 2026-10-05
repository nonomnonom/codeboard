import type { Point } from "../model/types.js";

export function translate(points: Point[], x: number, y: number): Point[] {
  return points.map((point) => ({ ...point, x: point.x + x, y: point.y + y }));
}

export function scale(
  points: Point[],
  scaleX: number,
  scaleY = scaleX,
  origin = { x: 0, y: 0 },
): Point[] {
  return points.map((point) => ({
    ...point,
    x: origin.x + (point.x - origin.x) * scaleX,
    y: origin.y + (point.y - origin.y) * scaleY,
  }));
}

export function withPressure(points: Point[], pressure: number | ((t: number) => number)): Point[] {
  return points.map((point, index) => ({
    ...point,
    pressure:
      typeof pressure === "function" ? pressure(index / Math.max(1, points.length - 1)) : pressure,
  }));
}

export function mirrored(points: Point[], axisX: number): Point[] {
  return points.map((point) => ({ ...point, x: axisX * 2 - point.x }));
}
