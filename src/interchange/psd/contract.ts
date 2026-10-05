import { z } from "zod";
import type { Layer } from "../../model/types.js";
import { psdError } from "./reader.js";

export interface PSDImportOptions {
  /** Prefix for deterministic imported layer/element IDs; choose a fresh namespace per source. */
  namespace: string;
  /** Explicit interpretation of this subset's untagged RGB channels. Tagged profiles reject. */
  sourceColorSpace: "srgb";
  lossPolicy?: "reject" | "report";
}
export interface PSDImportLoss {
  path: string;
  reason: string;
}
export interface PSDImportResult {
  width: number;
  height: number;
  layers: Layer[];
  sourceSha256: string;
  losses: PSDImportLoss[];
}

const schema = z
  .object({
    namespace: z.string().trim().min(1).max(128),
    sourceColorSpace: z.literal("srgb"),
    lossPolicy: z.enum(["reject", "report"]).default("reject"),
  })
  .strict();
export function psdOptions(input: PSDImportOptions) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) psdError("/options", "Invalid import options");
  return parsed.data;
}
