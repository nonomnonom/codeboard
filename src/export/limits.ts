import { CodeboardError } from "../model/errors.js";
import { z } from "zod";

const frameRangeSchema = z
  .object({
    startFrame: z.number().int().nonnegative().safe(),
    endFrame: z.number().int().positive().safe(),
  })
  .strict();

export function resolveFrameRange(total: number, input?: { startFrame: number; endFrame: number }) {
  const parsed = frameRangeSchema.safeParse(
    input === undefined ? { startFrame: 0, endFrame: total } : input,
  );
  if (
    !parsed.success ||
    !Number.isSafeInteger(total) ||
    parsed.data.endFrame <= parsed.data.startFrame ||
    parsed.data.endFrame > total
  )
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Frame range must be nonempty and within the timeline",
    );
  return parsed.data;
}

/** Frame sequences may be empty; container encoders add their own nonempty requirement. */
export function assertFrameLimit(total: number, maximum = 100000): void {
  if (!Number.isSafeInteger(maximum) || maximum < 1)
    throw new CodeboardError("INVALID_ARGUMENT", "maxFrames must be a positive safe integer");
  if (!Number.isSafeInteger(total) || total < 0 || total > maximum)
    throw new CodeboardError(
      "RESOURCE_LIMIT",
      "Frame export limit exceeded or frame count is invalid",
    );
}
