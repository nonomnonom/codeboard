import { z } from "zod";
import { CodeboardError } from "../model/errors.js";
import { renderIdentitySchema, type RenderIdentity } from "../model/schema/render-identity.js";
import { fontFilesSchema, type FontFileDependency } from "../model/schema/font-files.js";

export interface ProjectPublishManifest {
  format: "codeboard-project-publish/1";
  source: { projectId: string; version: number; documentHash: string };
  file: { name: "project.cboard"; bytes: number; sha256: string };
  engine: RenderIdentity;
  externalFonts: string[];
  fontFiles?: FontFileDependency[];
}

const id = z.string().min(1).max(4096);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const schema = z
  .object({
    format: z.literal("codeboard-project-publish/1"),
    source: z
      .object({ projectId: id, version: z.number().int().nonnegative().safe(), documentHash: hash })
      .strict(),
    file: z
      .object({
        name: z.literal("project.cboard"),
        bytes: z
          .number()
          .int()
          .positive()
          .safe()
          .max(1024 * 1024 * 1024),
        sha256: hash,
      })
      .strict(),
    engine: renderIdentitySchema,
    externalFonts: z.array(id).max(10000),
    fontFiles: fontFilesSchema.optional(),
  })
  .strict();
export const MAX_PUBLISH_MANIFEST_BYTES = 262144;

export function parseProjectPublishManifest(input: unknown): ProjectPublishManifest {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid project publish manifest");
  if (Buffer.byteLength(JSON.stringify(parsed.data)) > MAX_PUBLISH_MANIFEST_BYTES)
    throw new CodeboardError("RESOURCE_LIMIT", "Project publish manifest exceeds 256 KiB");
  if (new Set(parsed.data.externalFonts).size !== parsed.data.externalFonts.length)
    throw new CodeboardError("INVALID_ARGUMENT", "Publish font declarations must be unique");
  const { fontFiles, ...manifest } = parsed.data;
  return { ...manifest, ...(fontFiles === undefined ? {} : { fontFiles }) };
}
