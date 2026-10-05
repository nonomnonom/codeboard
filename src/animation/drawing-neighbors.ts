import type { DrawingExposure, DrawingInterval, DrawingNeighbors } from "../model/types.js";
import { assertRenderFrame } from "./frame.js";
import { evaluateDrawing } from "./evaluate.js";

/** Inspect held drawings, clipped to the owning panel or shot; no artwork is loaded or cloned. */
export function drawingNeighbors(
  keys: readonly DrawingExposure[],
  frame: number,
  start: number,
  end: number,
  skipBlank: boolean,
): DrawingNeighbors {
  assertRenderFrame(frame);
  if (frame < start || frame >= end)
    throw new Error(`Frame ${frame} is outside the drawing's output interval [${start}, ${end})`);
  if (typeof skipBlank !== "boolean") throw new Error("skipBlank must be boolean");
  let previous: DrawingInterval | null = null,
    current: DrawingInterval | null = null,
    next: DrawingInterval | null = null;
  let runStart = start;
  let drawingId: string | null = evaluateDrawing(keys, start) ?? null;
  const visit = (endFrame: number) => {
    const interval = { startFrame: runStart, endFrame, drawingId };
    if (frame >= runStart && frame < endFrame) current = interval;
    else if (!skipBlank || drawingId !== null) {
      if (endFrame <= frame) previous = interval;
      else if (runStart > frame && next === null) next = interval;
    }
  };
  for (const key of keys) {
    if (key.frame <= start) continue;
    if (key.frame >= end) break;
    if (key.drawingId === drawingId) continue;
    visit(key.frame);
    runStart = key.frame;
    drawingId = key.drawingId;
  }
  visit(end);
  return { current: current!, previous, next };
}
