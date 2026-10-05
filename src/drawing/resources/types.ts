import type { BrushPreset, BrushTip } from "../../model/types.js";

export interface ResourceOrigin {
  source: string;
  author?: string;
  license: string;
  redistribution: "allowed" | "unknown" | "forbidden";
}
export interface BrushResource {
  id: string;
  name: string;
  role: "tip" | "texture";
  tip: Extract<BrushTip, { kind: "bitmap" }>;
  originalWidth: number;
  originalHeight: number;
  checksum: string;
  origin: ResourceOrigin;
}
export interface ImportedPreset {
  name: string;
  engine: string;
  parameters: Record<string, string>;
  resourceIds: string[];
  mapped: Partial<Pick<BrushPreset, "spacing" | "opacity" | "flow">>;
  missingDependencies: string[];
  unsupported: string[];
}
export interface BrushImportReport {
  format: string;
  source: ResourceOrigin;
  checksum: string;
  resources: BrushResource[];
  presets: ImportedPreset[];
  mapped: string[];
  missingDependencies: string[];
  unsupported: string[];
  warnings: string[];
}
export interface ImportOptions {
  origin: ResourceOrigin;
  maxTipSize?: number;
  maskMode?: "alpha" | "luminance" | "inverse-luminance";
  dependencies?: Record<string, Buffer>;
  role?: "tip" | "texture";
}
