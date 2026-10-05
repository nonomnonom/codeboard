import { Canvas } from "skia-canvas";

const context = new Canvas(1, 1).getContext("2d"),
  cache = new Map<string, boolean>();

export function isDrawingColor(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const cached = cache.get(value);
  if (cached !== undefined) return cached;
  let valid = false;
  try {
    // Canvas ignores invalid styles; two prior styles distinguish rejection from a valid match.
    context.fillStyle = "#010203";
    context.fillStyle = value;
    const first = context.fillStyle;
    context.fillStyle = "#040506";
    context.fillStyle = value;
    valid = first === context.fillStyle;
  } catch {}
  if (cache.size >= 256) cache.delete(cache.keys().next().value!);
  cache.set(value, valid);
  return valid;
}
