import type { VectorFill } from "../model/types.js";
import { isDrawingColor } from "./css-color.js";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function point(
  value: unknown,
  radial: boolean,
): value is { x: number; y: number; radius?: number } {
  if (!record(value)) return false;
  const keys = radial ? ["x", "y", "radius"] : ["x", "y"];
  if (Object.keys(value).some((key) => !keys.includes(key))) return false;
  for (const key of keys) {
    const coordinate = value[key];
    if (
      typeof coordinate !== "number" ||
      !Number.isFinite(coordinate) ||
      !Number.isFinite(Math.fround(coordinate))
    )
      return false;
  }
  return !radial || (typeof value.radius === "number" && value.radius >= 0);
}

export function isVectorFill(value: unknown): value is VectorFill {
  if (typeof value === "string") return isDrawingColor(value);
  if (
    !record(value) ||
    (value.kind !== "linear" && value.kind !== "radial") ||
    Object.keys(value).some((key) => !["kind", "from", "to", "stops"].includes(key))
  )
    return false;
  const radial = value.kind === "radial",
    from = value.from,
    to = value.to;
  if (!point(from, radial) || !point(to, radial)) return false;
  if (from.x === to.x && from.y === to.y && (!radial || from.radius === to.radius)) return false;
  if (!Array.isArray(value.stops) || value.stops.length < 2) return false;
  let previous = 0;
  for (const stop of value.stops) {
    if (
      !record(stop) ||
      Object.keys(stop).some((key) => !["offset", "color"].includes(key)) ||
      typeof stop.offset !== "number" ||
      !Number.isFinite(stop.offset) ||
      stop.offset < previous ||
      stop.offset > 1 ||
      !isDrawingColor(stop.color)
    )
      return false;
    previous = stop.offset;
  }
  return true;
}
