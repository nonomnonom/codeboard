import { z } from "zod";
import { defineShotAnimation } from "../../animation/shot.js";
import { normalizeRate, rescaleTime, type RationalRate } from "../../animation/rational-time.js";
import { CodeboardError } from "../../model/errors.js";
import { boundQueryResponse } from "../../model/query.js";
import type { ShotAnimation } from "../../model/types/shot.js";

export interface OTIOMediaBinding {
  animationId: string;
  /** Exact external reference URL; never fetched or resolved by the adapter. */
  targetUrl: string;
  /** Media frame corresponding to animation frame zero, at the animation's rate. */
  sourceStartFrame?: number;
}
export interface OTIOOptions {
  media: OTIOMediaBinding[];
  /** Reject unrepresented metadata/audio by default; report permits listed omissions. */
  lossPolicy?: "reject" | "report";
}
export interface OTIOImportOptions extends OTIOOptions {
  sequenceId: string;
  frameRate: RationalRate;
}
export interface OTIOLoss {
  path: string;
  reason: string;
}

const id = z.string().min(1).max(4096);
const optionsSchema = z
  .object({
    media: z
      .array(
        z
          .object({
            animationId: id,
            targetUrl: id,
            sourceStartFrame: z.number().int().safe().default(0),
          })
          .strict(),
      )
      .min(1)
      .max(1000),
    lossPolicy: z.enum(["reject", "report"]).default("reject"),
  })
  .strict();
const importOptionsSchema = optionsSchema.extend({
  sequenceId: id,
  frameRate: z
    .object({
      numerator: z.number().int().positive().safe(),
      denominator: z.number().int().positive().safe(),
    })
    .strict(),
});

export function invalid(path: string, reason: string): never {
  throw new CodeboardError("INVALID_ARGUMENT", `OTIO ${path}: ${reason}`, {
    details: { path, reason },
  });
}
export function parse<T>(schema: z.ZodType<T>, input: unknown, path: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0]!;
    invalid(`${path}${issue.path.map((part) => `/${String(part)}`).join("")}`, issue.message);
  }
  return result.data;
}
export function importOptions(input: OTIOImportOptions) {
  const options = parse(importOptionsSchema, input, "/options");
  return { ...options, frameRate: normalizeRate(options.frameRate) };
}
export function context(input: OTIOOptions, animations: readonly ShotAnimation[]) {
  const options = parse(optionsSchema, input, "/options");
  const sources = new Map(
    animations.map((value) => {
      const animation = defineShotAnimation(value);
      return [animation.id, animation] as const;
    }),
  );
  if (sources.size !== animations.length) invalid("/animations", "Duplicate animation IDs");
  const byUrl = new Map<string, (typeof options.media)[number]>();
  const byId = new Map<string, (typeof options.media)[number]>();
  for (const [index, binding] of options.media.entries()) {
    if (!sources.has(binding.animationId)) invalid(`/options/media/${index}`, "Missing animation");
    if (
      !Number.isSafeInteger(
        binding.sourceStartFrame + sources.get(binding.animationId)!.durationFrames,
      )
    )
      invalid(`/options/media/${index}/sourceStartFrame`, "Media end exceeds safe frame limits");
    if (byUrl.has(binding.targetUrl) || byId.has(binding.animationId))
      invalid(`/options/media/${index}`, "Media URLs and animation IDs must be unique");
    byUrl.set(binding.targetUrl, binding);
    byId.set(binding.animationId, binding);
  }
  const losses: OTIOLoss[] = [];
  return {
    sources,
    byUrl,
    byId,
    losses,
    lose(path: string, reason: string) {
      if (options.lossPolicy === "reject")
        invalid(path, `${reason}; use lossPolicy: report to omit`);
      losses.push({ path, reason });
    },
    finish() {
      return boundQueryResponse(losses, "OTIO loss report");
    },
  };
}
export function jsonSize(json: string): void {
  if (typeof json !== "string") invalid("/", "Expected a JSON string");
  const bytes = Buffer.byteLength(json);
  if (bytes > 1048576)
    throw new CodeboardError("RESOURCE_LIMIT", "OTIO JSON exceeds 1 MiB", {
      details: { bytes, maxBytes: 1048576 },
    });
}
export function frame(
  time: { value: number; rate: number },
  target: RationalRate,
  rates: RationalRate[],
  path: string,
  rounding: "exact" | "ceil" = "exact",
): number {
  // OTIO stores a double rate. Recover only fractions explicitly supplied by this conform.
  const source = rates.find((rate) => rate.numerator / rate.denominator === time.rate) ?? time.rate;
  try {
    return rescaleTime(time.value, source, target, rounding).value;
  } catch (cause) {
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      `OTIO ${path}: time cannot be represented at the requested rate`,
      {
        details: { path },
        cause,
      },
    );
  }
}
