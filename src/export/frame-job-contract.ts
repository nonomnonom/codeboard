import {
  fontFilesSchema as frameJobFontsSchema,
  type FontFileDependency,
} from "../model/schema/font-files.js";
import { z } from "zod";
import { CodeboardError } from "../model/errors.js";
import { validateDimensions } from "../model/validation/pixels.js";
import { renderIdentitySchema, type RenderIdentity } from "../model/schema/render-identity.js";
import { shotRenderOptionsSchema } from "../model/schema/shot-render.js";
import type { ShotRenderOptions } from "../model/types/shot.js";

export type FrameOutputProfile = {
  width: number;
  height: number;
  fit: "contain" | "cover" | "fill";
} & ({ alpha: "preserve" } | { alpha: "flatten"; background: { r: number; g: number; b: number } });

export type FrameJobFontFile = FontFileDependency;

export interface FrameJobManifest {
  format: "codeboard-frame-job/1";
  source: { path: string; projectId: string; version: number; documentHash: string };
  target:
    | { kind: "shot"; animationId: string; render?: ShotRenderOptions }
    | { kind: "editorial"; sequenceId: string };
  range: { startFrame: number; endFrame: number };
  frameRate: { numerator: number; denominator: number };
  renderer: RenderIdentity;
  maxBytes: number;
  fontPolicy?: "allow-fallback" | "require-available";
  outputProfile?: FrameOutputProfile;
  fontFiles?: FrameJobFontFile[];
}

const integer = z.number().int().nonnegative().safe();

const id = z.string().min(1).max(4096);
const dimensions = {
  width: integer.positive(),
  height: integer.positive(),
  fit: z.enum(["contain", "cover", "fill"]),
};
const channel = integer.max(255);
const outputProfile = z.discriminatedUnion("alpha", [
  z.object({ ...dimensions, alpha: z.literal("preserve") }).strict(),
  z
    .object({
      ...dimensions,
      alpha: z.literal("flatten"),
      background: z.object({ r: channel, g: channel, b: channel }).strict(),
    })
    .strict(),
]);

const schema = z
  .object({
    format: z.literal("codeboard-frame-job/1"),
    source: z
      .object({
        path: id,
        projectId: id,
        version: integer,
        documentHash: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
    target: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("shot"),
          animationId: id,
          render: shotRenderOptionsSchema.optional(),
        })
        .strict()
        .transform(({ render, ...target }) => ({
          ...target,
          ...(render === undefined ? {} : { render }),
        })),
      z.object({ kind: z.literal("editorial"), sequenceId: id }).strict(),
    ]),
    range: z.object({ startFrame: integer, endFrame: integer }).strict(),
    frameRate: z
      .object({ numerator: integer.positive(), denominator: integer.positive() })
      .strict(),
    renderer: renderIdentitySchema,
    maxBytes: integer.positive().max(1024 * 1024 * 1024),
    fontPolicy: z.enum(["allow-fallback", "require-available"]).optional(),
    outputProfile: outputProfile.optional(),
    fontFiles: frameJobFontsSchema.optional(),
  })
  .strict();

export const MAX_MANIFEST_BYTES = 65536;

export function parseJobManifest(input: unknown): FrameJobManifest {
  const parsed = schema.safeParse(input);
  if (
    !parsed.success ||
    parsed.data.range.endFrame <= parsed.data.range.startFrame ||
    parsed.data.range.endFrame - parsed.data.range.startFrame > 100000
  )
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid frame job manifest");
  if (Buffer.byteLength(JSON.stringify(parsed.data)) > MAX_MANIFEST_BYTES)
    throw new CodeboardError("RESOURCE_LIMIT", "Frame job manifest exceeds 64 KiB");
  const { fontPolicy, fontFiles, outputProfile: profile, ...manifest } = parsed.data;
  if (profile) validateDimensions(profile.width, profile.height);
  return {
    ...manifest,
    ...(fontPolicy === undefined ? {} : { fontPolicy }),
    ...(fontFiles === undefined ? {} : { fontFiles }),
    ...(profile === undefined ? {} : { outputProfile: profile }),
  };
}
