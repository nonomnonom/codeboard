import { z } from "zod";
import type { Transition } from "../model/types.js";
import type { RationalRate } from "../animation/rational-time.js";
import { CodeboardError } from "../model/errors.js";

export type ReviewTarget =
  | { kind: "board" }
  | { kind: "shot"; animationId: string }
  | { kind: "editorial"; sequenceId: string };
export type ReviewFrameSource =
  | { kind: "board"; panelId: string; incomingPanelId?: string; transitionProgress: number }
  | { kind: "shot"; animationId: string; sourceFrame: number }
  | {
      kind: "editorial";
      sequenceId: string;
      outgoing: { clipId: string; animationId: string; sourceFrame: number };
      incoming?: { clipId: string; animationId: string; sourceFrame: number };
      transition: Transition["type"];
      transitionProgress: number;
    };

export interface ReviewExportOptions {
  target?: ReviewTarget;
  frames: number[];
  expectedVersion: number;
  revision?: string;
  annotations?: boolean;
  signal?: AbortSignal;
}

export interface ReviewManifest {
  format: "codeboard-review/2";
  createdAt: string;
  source: {
    projectId: string;
    version: number;
    schemaVersion: number;
    documentHash: string;
    revision?: string;
  };
  renderer: { package: string; version: string; node: string; platform: string };
  settings: {
    target: ReviewTarget;
    annotations: boolean;
    frameRate: RationalRate;
    space: "camera";
    imageFormat: "PNG";
  };
  frames: {
    frame: number;
    file: string;
    sha256: string;
    bytes: number;
    width: number;
    height: number;
    source: ReviewFrameSource;
  }[];
}

const targetId = z.string().min(1).max(4096);
export const reviewTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("board") }).strict(),
  z.object({ kind: z.literal("shot"), animationId: targetId }).strict(),
  z.object({ kind: z.literal("editorial"), sequenceId: targetId }).strict(),
]);
const optionsSchema = z
  .object({
    target: reviewTargetSchema.optional(),
    frames: z
      .array(z.number().int().nonnegative().safe())
      .min(1)
      .max(120)
      .refine((values) => new Set(values).size === values.length, "Review frames must be unique"),
    expectedVersion: z.number().int().nonnegative().safe(),
    revision: z
      .string()
      .min(1)
      .max(128)
      .refine((value) => value.trim().length > 0, "Revision name must not be blank")
      .optional(),
    annotations: z.boolean().optional(),
    signal: z.instanceof(AbortSignal).optional(),
  })
  .strict();

export function parseReviewOptions(options: unknown) {
  const parsed = optionsSchema.safeParse(options);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid review export options", {
      details: { issues: parsed.error.issues },
    });
  return parsed.data;
}
