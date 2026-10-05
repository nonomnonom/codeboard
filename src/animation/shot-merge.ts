import { isDeepStrictEqual as equal } from "node:util";
import type { ShotAnimation } from "../model/types/shot.js";
import { CodeboardError } from "../model/errors.js";
import { defineShotAnimation } from "./shot.js";
import {
  mergeValueSnapshots,
  type ValueMergeOptions,
  type ValueMergeConflict,
  type ValueMergeReport,
} from "../model/value-merge.js";
export type ShotMergeOptions = ValueMergeOptions;
export type ShotMergeConflict = ValueMergeConflict;
export type ShotMergeReport = ValueMergeReport;

/** Merge snapshots with shared IDs; unresolved conflicts produce no animation. */
export function mergeShotAnimation(
  baseInput: ShotAnimation,
  localInput: ShotAnimation,
  incomingInput: ShotAnimation,
  options: ShotMergeOptions = {},
): ShotMergeReport & { animation: ShotAnimation | null } {
  const base = defineShotAnimation(baseInput),
    local = defineShotAnimation(localInput),
    incoming = defineShotAnimation(incomingInput);
  if ([local, incoming].some((shot) => shot.id !== base.id || shot.shotId !== base.shotId))
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Shot merge requires the same animation and shot IDs",
    );
  const changedTiming = [local, incoming].some(
    (shot) => !equal(shot.frameRate, base.frameRate) || shot.durationFrames !== base.durationFrames,
  );
  const timingConflict =
    changedTiming && !equal(base, local) && !equal(base, incoming) && !equal(local, incoming);
  const { value, ...report } = mergeValueSnapshots(
    base,
    local,
    incoming,
    options,
    timingConflict ? "timing" : undefined,
  );
  return { ...report, animation: value === null ? null : defineShotAnimation(value) };
}
