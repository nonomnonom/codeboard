import { z } from "zod";
import { open } from "node:fs/promises";
import type { ImportOptions } from "./types.js";
import { CodeboardError } from "../../model/errors.js";

const maximumInputBytes = 64 * 1024 * 1024;

export async function readResourceFile(path: string): Promise<Buffer> {
  const file = await open(path, "r");
  try {
    if ((await file.stat()).size > maximumInputBytes)
      throw new CodeboardError("RESOURCE_LIMIT", "Brush resource exceeds 64 MB input limit");
    const chunks: Buffer[] = [];
    let total = 0;
    for (;;) {
      const chunk = Buffer.allocUnsafe(Math.min(65536, maximumInputBytes - total + 1));
      const { bytesRead } = await file.read(chunk, 0, chunk.length, null);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > maximumInputBytes)
        throw new CodeboardError("RESOURCE_LIMIT", "Brush resource exceeds 64 MB input limit");
      chunks.push(chunk.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks, total);
  } finally {
    await file.close();
  }
}

const optionsSchema = z
  .object({
    origin: z
      .object({
        source: z.string(),
        author: z.string().optional(),
        license: z.string(),
        redistribution: z.enum(["allowed", "unknown", "forbidden"]),
      })
      .strict(),
    maxTipSize: z.number().int().min(1).max(512).optional(),
    maskMode: z.enum(["alpha", "luminance", "inverse-luminance"]).optional(),
    role: z.enum(["tip", "texture"]).optional(),
    dependencies: z
      .record(z.string(), z.custom<Buffer>(Buffer.isBuffer, "Dependency must be a Buffer"))
      .optional(),
  })
  .strict();

export function assertResourceBytes(data: Buffer): void {
  if (!Buffer.isBuffer(data))
    throw new CodeboardError("INVALID_ARGUMENT", "Brush resource must be a Buffer");
  if (data.length > maximumInputBytes)
    throw new CodeboardError("RESOURCE_LIMIT", "Brush resource exceeds 64 MB input limit");
}

export function captureImportOptions(input: ImportOptions): ImportOptions {
  const result = optionsSchema.safeParse(input);
  if (!result.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid brush import options", {
      details: { issues: result.error.issues },
    });
  const options = result.data;
  const entries = Object.entries(options.dependencies ?? {});
  let total = 0;
  if (entries.length > 4096)
    throw new CodeboardError("RESOURCE_LIMIT", "Brush dependencies exceed 4096 entries");
  for (const [, bytes] of entries) {
    total += bytes.length;
    if (bytes.length > 16 * 1024 * 1024 || total > 64 * 1024 * 1024)
      throw new CodeboardError(
        "RESOURCE_LIMIT",
        "Brush dependencies exceed per-entry or total byte limits",
      );
  }
  return {
    origin: {
      source: options.origin.source,
      license: options.origin.license,
      redistribution: options.origin.redistribution,
      ...(options.origin.author === undefined ? {} : { author: options.origin.author }),
    },
    ...(options.maxTipSize === undefined ? {} : { maxTipSize: options.maxTipSize }),
    ...(options.maskMode === undefined ? {} : { maskMode: options.maskMode }),
    ...(options.role === undefined ? {} : { role: options.role }),
    ...(options.dependencies === undefined
      ? {}
      : {
          dependencies: Object.fromEntries(
            entries.map(([name, bytes]) => [name, Buffer.from(bytes)]),
          ),
        }),
  };
}
