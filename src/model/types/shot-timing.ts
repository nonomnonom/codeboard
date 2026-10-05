import type { RationalRate, TimeRounding } from "../../animation/rational-time.js";

export interface ShotRetimeOptions {
  durationFrames: number;
  frameRate?: RationalRate;
  /** Exact by default; any quantization must be explicitly selected. */
  rounding?: TimeRounding;
  /** Source samples/fades are never stretched; choose how cue starts follow the new timing. */
  audio: "preserve-seconds" | "scale-starts";
}
