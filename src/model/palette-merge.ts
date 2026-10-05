import type { Palette } from "./types/palettes.js";
import { paletteSchema } from "./schema/palettes.js";
import { mergeValueSnapshots, type ValueMergeOptions } from "./value-merge.js";
import { CodeboardError } from "./errors.js";

export type PaletteMergeOptions = ValueMergeOptions;

function readPalette(input: Palette | null): Palette | null {
  if (input === null) return null;
  const parsed = paletteSchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid palette merge snapshot", {
      details: { issues: parsed.error.issues },
    });
  const palette = parsed.data;
  const ids = new Set([palette.id]);
  for (const swatch of palette.swatches) {
    if (ids.has(swatch.id))
      throw new CodeboardError("INVALID_ARGUMENT", "Palette merge IDs must be unique");
    ids.add(swatch.id);
  }
  return palette;
}

/** Merge one shared palette identity; null snapshots represent absence, not inferred matches. */
export function mergePalette(
  baseInput: Palette | null,
  localInput: Palette | null,
  incomingInput: Palette | null,
  options: PaletteMergeOptions = {},
) {
  const base = readPalette(baseInput),
    local = readPalette(localInput),
    incoming = readPalette(incomingInput);
  const present = [base, local, incoming].filter((entry): entry is Palette => entry !== null);
  const id = present[0]?.id;
  if (!id || present.some((entry) => entry.id !== id))
    throw new CodeboardError("INVALID_ARGUMENT", "Palette merge requires one shared palette ID");
  const { value, ...report } = mergeValueSnapshots(base, local, incoming, options);
  const conflictsResolved = report.conflicts.every((entry) => entry.resolution !== "unresolved");
  return {
    id,
    ...report,
    conflictsResolved,
    palette: conflictsResolved ? readPalette(value) : null,
  };
}
