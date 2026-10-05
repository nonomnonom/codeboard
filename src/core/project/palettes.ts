import type { StoryboardDocument } from "../../model/types.js";
import type { ColorBinding, ColorChannel, Palette } from "../../model/types/palettes.js";
import { paletteArtwork, paletteColors, boundColor, colorSlot } from "../../model/palettes.js";
import { CodeboardError } from "../../model/errors.js";

export function putPalette(document: StoryboardDocument, palette: Palette): void {
  const palettes = [...(document.studio.palettes ?? [])];
  const index = palettes.findIndex((entry) => entry.id === palette.id);
  if (index < 0) palettes.push(palette);
  else palettes[index] = palette;
  const colors = paletteColors({ ...document, studio: { ...document.studio, palettes } });
  const updates: { slot: ReturnType<typeof colorSlot>; channel: ColorChannel; color: string }[] =
    [];
  for (const element of paletteArtwork(document))
    for (const channel of ["color", "fill", "stroke"] as const) {
      const binding = element.colorBindings?.[channel];
      if (binding)
        updates.push({
          slot: colorSlot(element, channel),
          channel,
          color: boundColor(colors, binding),
        });
    }
  document.studio = { ...document.studio, palettes };
  for (const { slot, channel, color } of updates) slot[channel] = color;
}

export function removePalette(document: StoryboardDocument, id: string): void {
  const palettes = document.studio.palettes ?? [];
  const index = palettes.findIndex((palette) => palette.id === id);
  if (index < 0) throw new CodeboardError("INVALID_ARGUMENT", `Palette not found: ${id}`);
  const removed = new Set(palettes[index]!.swatches.map((swatch) => swatch.id));
  for (const element of paletteArtwork(document))
    for (const binding of Object.values(element.colorBindings ?? {}))
      if (binding && removed.has(binding.swatchId))
        throw new CodeboardError("INVALID_ARGUMENT", "Cannot remove a referenced palette", {
          details: { paletteId: id, swatchId: binding.swatchId, elementId: element.id },
        });
  document.studio = {
    ...document.studio,
    palettes: palettes.filter((_, position) => position !== index),
  };
}

export function setColorBinding(
  document: StoryboardDocument,
  elementId: string,
  channel: ColorChannel,
  binding: ColorBinding | null,
): void {
  const element = [...paletteArtwork(document)].find((entry) => entry.id === elementId);
  if (!element)
    throw new CodeboardError("INVALID_ARGUMENT", `Artwork element not found: ${elementId}`);
  const slot = colorSlot(element, channel);
  if (binding) {
    slot[channel] = boundColor(paletteColors(document), binding);
    element.colorBindings ??= {};
    element.colorBindings[channel] = binding;
  } else if (element.colorBindings) {
    delete element.colorBindings[channel];
    if (Object.keys(element.colorBindings).length === 0) delete element.colorBindings;
  }
}
