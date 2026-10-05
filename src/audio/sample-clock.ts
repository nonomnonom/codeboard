import { rescaleTime, type RationalRate } from "../animation/rational-time.js";
import { CodeboardError } from "../model/errors.js";

export type AudioSampleRounding = "nearest" | "exact";

/** One output clock and quantization policy for every placement, trim and fade in a conform. */
export function audioSampleClock(sampleRate: number, rounding: AudioSampleRounding = "nearest") {
  if (!Number.isSafeInteger(sampleRate) || sampleRate < 1)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Output sample rate must be a positive safe integer",
    );
  if (rounding !== "nearest" && rounding !== "exact")
    throw new CodeboardError("INVALID_ARGUMENT", "Audio sample rounding must be nearest or exact");
  return (ticks: number, sourceRate: number | RationalRate) =>
    rescaleTime(ticks, sourceRate, sampleRate, rounding);
}
