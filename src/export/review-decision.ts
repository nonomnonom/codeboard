import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { fingerprint } from "../core/edit-plan/fingerprint.js";
import { CodeboardError } from "../model/errors.js";
import { reviewTargetSchema, type ReviewTarget } from "./review-contract.js";
import { verifyReviewExport } from "./verify-review.js";
import { readReviewSourceDocument } from "./review-source-read.js";

export interface ReviewDecisionInput {
  id: string;
  reviewer: { id: string; kind: "human" | "agent" };
  outcome: "approved" | "changes-requested" | "not-reviewed";
  criteria: string[];
  frames: number[];
  notes: string;
}
export interface ReviewDecision extends ReviewDecisionInput {
  format: "codeboard-review-decision/1";
  createdAt: string;
  evidence: {
    manifestSha256: string;
    projectId: string;
    version: number;
    documentHash: string;
    target: ReviewTarget;
  };
  sha256: string;
}

export interface ReviewDecisionVerifyOptions {
  decode?: boolean;
  signal?: AbortSignal;
  source?: { projectPath: string; revision?: string };
}
const id = z.string().min(1).max(4096);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const count = z.number().int().nonnegative().safe();
const inputSchema = z
  .object({
    id,
    reviewer: z.object({ id, kind: z.enum(["human", "agent"]) }).strict(),
    outcome: z.enum(["approved", "changes-requested", "not-reviewed"]),
    criteria: z.array(z.string().min(1).max(4096)).min(1).max(32),
    frames: z.array(count).max(120),
    notes: z.string().max(16384),
  })
  .strict();
const bodySchema = inputSchema
  .extend({
    format: z.literal("codeboard-review-decision/1"),
    createdAt: z.iso.datetime(),
    evidence: z
      .object({
        manifestSha256: hash,
        projectId: id,
        version: count,
        documentHash: hash,
        target: reviewTargetSchema,
      })
      .strict(),
  })
  .strict();
const recordSchema = bodySchema.extend({ sha256: hash }).strict();
const verifyOptionsSchema = z
  .object({
    decode: z.boolean().default(false),
    signal: z.instanceof(AbortSignal).optional(),
    source: z
      .object({
        projectPath: z.string().min(1),
        revision: z
          .string()
          .min(1)
          .max(128)
          .refine((value) => value.trim().length > 0)
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

function validateSelection(input: ReviewDecisionInput) {
  if (
    new Set(input.frames).size !== input.frames.length ||
    (input.outcome !== "not-reviewed" && input.frames.length === 0) ||
    (input.outcome === "not-reviewed" && input.frames.length !== 0) ||
    input.criteria.some((criterion) => criterion.trim().length === 0)
  )
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Review decisions require distinct inspected frames and explicit criteria; not-reviewed requires no inspected frames",
    );
}

/** Read an unsigned, checksummed decision record; this does not verify its evidence files. */
export function readReviewDecision(input: unknown): ReviewDecision {
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid review decision", {
      details: { issues: parsed.error.issues },
    });
  const { sha256, ...body } = parsed.data;
  validateSelection(body);
  if (fingerprint(body) !== sha256)
    throw new CodeboardError("ASSET_CHECKSUM_MISMATCH", "Review decision checksum differs");
  return parsed.data as ReviewDecision;
}

function evidenceOf(verified: Awaited<ReturnType<typeof verifyReviewExport>>) {
  return {
    manifestSha256: verified.manifestSha256,
    projectId: verified.manifest.source.projectId,
    version: verified.manifest.source.version,
    documentHash: verified.manifest.source.documentHash,
    target: verified.manifest.settings.target,
  };
}

/** Bind an explicit caller decision to a verified package; does not infer approval or change project status. */
export async function createReviewDecision(
  directory: string,
  input: ReviewDecisionInput,
): Promise<ReviewDecision> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid review decision input", {
      details: { issues: parsed.error.issues },
    });
  validateSelection(parsed.data);
  const verified = await verifyReviewExport(directory);
  const available = new Set(verified.manifest.frames.map((frame) => frame.frame));
  if (parsed.data.frames.some((frame) => !available.has(frame)))
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Inspected frames must belong to the review package",
    );
  const body = bodySchema.parse({
    ...parsed.data,
    format: "codeboard-review-decision/1",
    createdAt: new Date().toISOString(),
    evidence: evidenceOf(verified),
  });
  return readReviewDecision({ ...body, sha256: fingerprint(body) });
}

/** Recheck decision checksum, manifest binding and file hashes before consuming a saved decision. */
export async function verifyReviewDecision(
  directory: string,
  input: unknown,
  options: ReviewDecisionVerifyOptions = {},
) {
  const parsed = verifyOptionsSchema.safeParse(options);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid review decision verification options", {
      details: { issues: parsed.error.issues },
    });
  const settings = parsed.data;
  const decision = readReviewDecision(input);
  const verified = await verifyReviewExport(directory, {
    decode: settings.decode,
    ...(settings.signal === undefined ? {} : { signal: settings.signal }),
  });
  const available = new Set(verified.manifest.frames.map((frame) => frame.frame));
  if (
    !isDeepStrictEqual(decision.evidence, evidenceOf(verified)) ||
    decision.frames.some((frame) => !available.has(frame))
  )
    throw new CodeboardError(
      "ASSET_CHECKSUM_MISMATCH",
      "Review decision refers to different evidence",
    );
  if (!settings.source) return { decision, verification: verified };
  settings.signal?.throwIfAborted();
  const document = readReviewSourceDocument(settings.source.projectPath, settings.source.revision);
  const actual = {
    projectId: document.id,
    version: document.version,
    documentHash: fingerprint(document),
  };
  const expected = {
    projectId: decision.evidence.projectId,
    version: decision.evidence.version,
    documentHash: decision.evidence.documentHash,
  };
  if (!isDeepStrictEqual(actual, expected))
    throw new CodeboardError(
      "REVISION_CONFLICT",
      "Review decision does not match the selected saved project snapshot",
      {
        details: { expected, actual },
      },
    );
  const target = decision.evidence.target;
  if (
    (target.kind === "shot" &&
      !document.studio.animations.some((shot) => shot.id === target.animationId)) ||
    (target.kind === "editorial" &&
      !document.studio.editorial.some((sequence) => sequence.id === target.sequenceId))
  )
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Review target is missing from the selected source",
    );
  settings.signal?.throwIfAborted();
  return {
    decision,
    verification: verified,
    source: {
      ...actual,
      ...(settings.source.revision === undefined ? {} : { revision: settings.source.revision }),
    },
  };
}
