import { basename, extname } from "node:path";
import { createHash } from "node:crypto";
import type { BrushPreset } from "../model/types.js";
import type { BrushResource, BrushImportReport, ImportOptions } from "./resources/types.js";
export type {
  ResourceOrigin,
  BrushResource,
  ImportedPreset,
  BrushImportReport,
  ImportOptions,
} from "./resources/types.js";
import { createResourceLoader } from "./resources/bitmap.js";
import { importPreset } from "./resources/preset.js";
import { readBundle } from "./resources/archive.js";
import { captureImportOptions, assertResourceBytes, readResourceFile } from "./resources/input.js";
const sha = (b: Buffer | Uint8Array) => createHash("sha256").update(b).digest("hex");

export async function importBrushResource(
  path: string,
  options: ImportOptions,
): Promise<BrushImportReport> {
  const captured = captureImportOptions(options);
  const data = await readResourceFile(path);
  assertResourceBytes(data);
  return importCapturedResource(data, basename(path), captured);
}

export async function importBrushResourceBuffer(
  data: Buffer,
  name: string,
  options: ImportOptions,
): Promise<BrushImportReport> {
  assertResourceBytes(data);
  const captured = captureImportOptions(options);
  return importCapturedResource(Buffer.from(data), name, captured);
}

async function importCapturedResource(
  data: Buffer,
  name: string,
  options: ImportOptions,
): Promise<BrushImportReport> {
  const max = options.maxTipSize ?? 128;
  const format = extname(name).toLowerCase().slice(1);
  const report: BrushImportReport = {
    format,
    source: options.origin,
    checksum: sha(data),
    resources: [],
    presets: [],
    mapped: [],
    missingDependencies: [],
    unsupported: [],
    warnings: [],
  };
  const load = createResourceLoader(report, options, max);
  if (format === "bundle") {
    const deps = readBundle(data);
    for (const [entry, bytes] of Object.entries(deps)) {
      if (entry.endsWith(".kpp")) await importPreset(bytes, entry, deps, report, load);
      else if (/^(brushes|kis_brushes)\//.test(entry)) await load(bytes, entry);
      else if (/^(patterns|kis_patterns)\//.test(entry)) await load(bytes, entry, "texture");
    }
    report.warnings.push(
      "Bundle metadata does not establish redistribution permission; origin/license is caller-supplied",
    );
  } else if (format === "kpp")
    await importPreset(data, name, options.dependencies ?? {}, report, load);
  else await load(data, name, options.role ?? "tip");
  return report;
}

/** Explicitly reauthor a resource for this engine; never promises source-application parity. */
export function brushFromResource(
  resource: BrushResource,
  settings: Omit<BrushPreset, "tip">,
): BrushPreset {
  if (resource.role !== "tip")
    throw new Error("A texture resource is not a brush tip; select a tip explicitly");
  return {
    ...structuredClone(settings),
    tip: structuredClone(resource.tip),
    provenance: { ...resource.origin, resourceChecksum: resource.checksum },
  };
}
