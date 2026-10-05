import type { BrushPreset } from "../types.js";
import { brush } from "../schema/brushes.js";

export function parseBrushDefinition(input: unknown): BrushPreset {
  const definition = brush.parse(input) as BrushPreset;
  validateBrushResources(definition, definition.id);
  return definition;
}

export function validateBrushResources(brush: BrushPreset, owner: string): void {
  const { tip, paperTexture } = brush;
  if (tip.kind === "bitmap" && tip.alpha.length !== tip.width * tip.height)
    throw new Error(`Invalid bitmap tip in ${owner}`);
  if (paperTexture && paperTexture.alpha.length !== paperTexture.width * paperTexture.height)
    throw new Error(`Invalid paper texture in ${owner}`);
}
