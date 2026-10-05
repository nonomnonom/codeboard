import type { DrawingExposure } from "../model/types.js";
import { CodeboardError } from "../model/errors.js";
import { evaluateDrawing } from "./evaluate.js";

/** Replace a half-open interval in a validated sequence, restoring its end-boundary drawing. */
export function replaceDrawingRange(
  sequence: readonly DrawingExposure[],
  startFrame: number,
  endFrame: number,
  drawingId: string | null,
): DrawingExposure[] {
  return replaceDrawingWindow(sequence, startFrame, endFrame, [{ frame: startFrame, drawingId }]);
}

/** Splice a complete replacement window into a validated drawing sequence. */
export function replaceDrawingWindow(
  sequence: readonly DrawingExposure[],
  startFrame: number,
  endFrame: number,
  replacement: readonly DrawingExposure[],
): DrawingExposure[] {
  if (
    !Number.isSafeInteger(startFrame) ||
    !Number.isSafeInteger(endFrame) ||
    endFrame <= startFrame
  )
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Drawing range requires ordered safe integer frames",
      {
        details: { reason: "DRAWING_RANGE", startFrame, endFrame },
      },
    );
  if (
    replacement[0]?.frame !== startFrame ||
    replacement.some(
      (key, index) =>
        !Number.isSafeInteger(key.frame) ||
        key.frame < startFrame ||
        key.frame >= endFrame ||
        (index > 0 && key.frame <= replacement[index - 1]!.frame),
    )
  )
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Replacement drawings must start at the range boundary and increase inside it",
      {
        details: { reason: "DRAWING_WINDOW_KEYS", startFrame, endFrame },
      },
    );
  const restore = evaluateDrawing(sequence, endFrame)!;
  const keys = sequence.filter((key) => key.frame < startFrame || key.frame >= endFrame);
  keys.push(...replacement);
  if (!keys.some((key) => key.frame === endFrame))
    keys.push({ frame: endFrame, drawingId: restore });
  return keys.sort((a, b) => a.frame - b.frame);
}
