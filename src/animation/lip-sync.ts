import { z } from "zod";
import { CodeboardError } from "../model/errors.js";
import type { DrawingExposure, DrawingInterval } from "../model/types.js";
import { rationalRateSchema } from "../model/schema/animation.js";
import { createTimeMapper, type RationalRate, type TimeRounding } from "./rational-time.js";

export interface MouthCue {
  startFrame: number;
  endFrame: number;
  mouth: string;
}
export interface LipSyncOptions {
  startFrame: number;
  endFrame: number;
  mouths: Record<string, string | null>;
  restDrawingId: string | null;
  cues: readonly MouthCue[];
  corrections?: readonly DrawingInterval[];
}

const frame = z.number().int().safe();
const drawingId = z.string().min(1).max(4096).nullable();
const range = z.object({ startFrame: frame, endFrame: frame });
const optionsSchema = range
  .extend({
    mouths: z.record(z.string().min(1).max(128), drawingId),
    restDrawingId: drawingId,
    cues: z.array(range.extend({ mouth: z.string().min(1).max(128) }).strict()).max(10000),
    corrections: z.array(range.extend({ drawingId }).strict()).max(10000).default([]),
  })
  .strict();

function readLipSync(input: LipSyncOptions) {
  const parsed = optionsSchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid lip-sync input", {
      details: { issues: parsed.error.issues },
    });
  const options = parsed.data;
  if (options.endFrame <= options.startFrame)
    throw new CodeboardError("INVALID_ARGUMENT", "Lip-sync range must be nonempty");
  const sorted = <T extends { startFrame: number; endFrame: number }>(
    entries: T[],
    label: string,
  ) => {
    entries.sort((a, b) => a.startFrame - b.startFrame);
    for (const [index, entry] of entries.entries()) {
      if (
        entry.startFrame < options.startFrame ||
        entry.endFrame > options.endFrame ||
        entry.endFrame <= entry.startFrame ||
        (index > 0 && entry.startFrame < entries[index - 1]!.endFrame)
      )
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          `${label} must be nonoverlapping, nonempty and inside the lip-sync range`,
          { details: { index } },
        );
    }
    return entries;
  };
  const cues = sorted(options.cues, "Mouth cues"),
    corrections = sorted(options.corrections, "Manual corrections");
  for (const cue of cues)
    if (!Object.hasOwn(options.mouths, cue.mouth))
      throw new CodeboardError("INVALID_ARGUMENT", "Unmapped mouth cue", {
        details: { mouth: cue.mouth },
      });
  return { ...options, cues, corrections };
}

export interface LipSyncTimingOptions {
  sourceRate: RationalRate;
  targetRate: RationalRate;
  rounding?: TimeRounding;
}

const timingSchema = z
  .object({
    sourceRate: rationalRateSchema,
    targetRate: rationalRateSchema,
    rounding: z.enum(["exact", "nearest", "floor", "ceil"]).default("exact"),
  })
  .strict();

/** Convert cue and correction clocks together without changing drawing assignments. */
export function rescaleLipSync(
  input: LipSyncOptions,
  timing: LipSyncTimingOptions,
): {
  options: LipSyncOptions;
  report: { rounding: TimeRounding; positions: number; quantizedPositions: number };
} {
  const parsed = timingSchema.safeParse(timing);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid lip-sync timing", {
      details: { issues: parsed.error.issues },
    });
  const options = readLipSync(input);
  const settings = parsed.data;
  const convert = createTimeMapper(settings.sourceRate, settings.targetRate, settings.rounding);
  const report = { rounding: settings.rounding, positions: 0, quantizedPositions: 0 };
  const mapRange = (
    entry: { startFrame: number; endFrame: number },
    collection: string,
    index: number,
  ) => {
    const map = (frame: number) => {
      try {
        const converted = convert(frame);
        report.positions++;
        if (!converted.exact) report.quantizedPositions++;
        return converted.value;
      } catch (cause) {
        if (cause instanceof CodeboardError)
          throw new CodeboardError(cause.code, cause.message, {
            details: { ...cause.details, collection, index, sourceFrame: frame },
            cause,
          });
        throw cause;
      }
    };
    const startFrame = map(entry.startFrame),
      endFrame = map(entry.endFrame);
    if (endFrame <= startFrame)
      throw new CodeboardError("INVALID_ARGUMENT", "Lip-sync conversion collapses an interval", {
        details: { reason: "INTERVAL_COLLAPSE", collection, index, startFrame, endFrame },
      });
    entry.startFrame = startFrame;
    entry.endFrame = endFrame;
  };
  mapRange(options, "range", 0);
  for (const [index, cue] of options.cues.entries()) mapRange(cue, "cues", index);
  for (const [index, cue] of options.corrections.entries()) mapRange(cue, "corrections", index);
  return { options: readLipSync(options), report };
}

/** Bake frame-addressed mouth cues into editable holds; explicit corrections take precedence. */
export function compileLipSync(input: LipSyncOptions): DrawingExposure[] {
  const options = readLipSync(input);
  const { cues, corrections } = options;
  const boundaries = [
    ...new Set([
      options.startFrame,
      options.endFrame,
      ...cues.flatMap((cue) => [cue.startFrame, cue.endFrame]),
      ...corrections.flatMap((cue) => [cue.startFrame, cue.endFrame]),
    ]),
  ].sort((a, b) => a - b);
  const keys: DrawingExposure[] = [];
  let cueIndex = 0,
    correctionIndex = 0;
  for (const current of boundaries) {
    while (cueIndex < cues.length && cues[cueIndex]!.endFrame <= current) cueIndex++;
    while (
      correctionIndex < corrections.length &&
      corrections[correctionIndex]!.endFrame <= current
    )
      correctionIndex++;
    const cue = cues[cueIndex],
      correction = corrections[correctionIndex];
    const value =
      correction && correction.startFrame <= current
        ? correction.drawingId
        : cue && cue.startFrame <= current
          ? options.mouths[cue.mouth]!
          : options.restDrawingId;
    if (!keys.length || keys.at(-1)!.drawingId !== value)
      keys.push({ frame: current, drawingId: value });
  }
  return keys;
}
