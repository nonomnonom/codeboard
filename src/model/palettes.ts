import type { DrawingElement, StoryboardDocument, VectorFill } from "./types.js";
import type { ColorBinding, ColorChannel } from "./types/palettes.js";
import { iterateLayers } from "./layers.js";
import { CodeboardError } from "./errors.js";

export function* paletteArtwork(document: StoryboardDocument): Generator<DrawingElement> {
  for (const entry of paletteArtworkEntries(document)) yield entry.element;
}

export function* paletteArtworkEntries(document: StoryboardDocument) {
  for (const [ownerKind, owners] of [
    ["panel", document.panels],
    ["component", document.components],
    ["animation", document.studio.animations],
  ] as const)
    for (const owner of owners)
      for (const layer of iterateLayers(owner.layers))
        if (layer.kind !== "group")
          for (const element of layer.elements)
            yield { ownerKind, ownerId: owner.id, layerId: layer.id, element };
}

export function colorSlot(
  element: DrawingElement,
  channel: ColorChannel,
): { color?: string; fill?: VectorFill; stroke?: string } {
  if (element.kind === "vector-path" && (channel === "fill" || channel === "stroke"))
    return element;
  if (element.kind === "vector-stroke" && (channel === "color" || channel === "fill"))
    return element;
  if ((element.kind === "raster-stroke" || element.kind === "text") && channel === "color")
    return element;
  throw new CodeboardError(
    "INVALID_ARGUMENT",
    `Color channel ${channel} is not supported by ${element.kind}: ${element.id}`,
  );
}

export function paletteColors(document: StoryboardDocument): Map<string, string> {
  return new Map(
    (document.studio.palettes ?? []).flatMap((palette) =>
      palette.swatches.map((swatch) => [swatch.id, swatch.color] as const),
    ),
  );
}

export function boundColor(colors: ReadonlyMap<string, string>, binding: ColorBinding): string {
  const color = colors.get(binding.swatchId);
  if (color === undefined)
    throw new CodeboardError("INVALID_ARGUMENT", `Missing palette swatch: ${binding.swatchId}`);
  return binding.override ?? color;
}

export function validatePaletteBindings(document: StoryboardDocument): void {
  const colors = paletteColors(document);
  for (const element of paletteArtwork(document))
    for (const channel of ["color", "fill", "stroke"] as const) {
      const binding = element.colorBindings?.[channel];
      if (!binding) continue;
      if (colorSlot(element, channel)[channel] !== boundColor(colors, binding))
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          `Bound color differs from its swatch or override: ${element.id}.${channel}; use setColorBinding or unbind first`,
        );
    }
}
