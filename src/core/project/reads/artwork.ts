import { locateLayer } from "../../../model/layer-tree.js";
import type {
  StoryboardDocument,
  Id,
  Layer,
  DrawingElement,
  PageOptions,
} from "../../../model/types.js";
import {
  allLayers,
  iterateLayers,
  findDocumentLayer,
  findPanelLayer,
} from "../../../model/layers.js";
import { pageBounds, boundQueryResponse } from "../../../model/query.js";
import { drawingNeighbors } from "../../../animation/drawing-neighbors.js";
import { CodeboardError } from "../../../model/errors.js";
import { paletteArtworkEntries, paletteColors } from "../../../model/palettes.js";
import type { PaletteBindingUsage } from "../../../model/types/palettes.js";

export function readPaletteBindings(
  document: StoryboardDocument,
  swatchId: string,
  options: PageOptions,
): PaletteBindingUsage[] {
  const { offset, limit } = pageBounds(options);
  if (!paletteColors(document).has(swatchId))
    throw new CodeboardError("INVALID_ARGUMENT", `Palette swatch not found: ${swatchId}`);
  const result: PaletteBindingUsage[] = [];
  let skipped = 0;
  for (const { element, ...owner } of paletteArtworkEntries(document)) {
    for (const channel of ["color", "fill", "stroke"] as const) {
      const binding = element.colorBindings?.[channel];
      if (!binding || binding.swatchId !== swatchId) continue;
      if (skipped++ < offset) continue;
      result.push({
        ...owner,
        elementId: element.id,
        channel,
        swatchId,
        ...(binding.override === undefined ? {} : { override: binding.override }),
      });
      if (result.length === limit) return boundQueryResponse(result, "Palette bindings");
    }
  }
  return boundQueryResponse(result, "Palette bindings");
}

export function readPalettes(document: StoryboardDocument, options: PageOptions) {
  const { offset, limit } = pageBounds(options);
  return boundQueryResponse(
    (document.studio.palettes ?? [])
      .slice(offset, offset + limit)
      .map(({ id, name, swatches }) => ({ id, name, swatchCount: swatches.length })),
  );
}

export function readPaletteSwatches(
  document: StoryboardDocument,
  id: string,
  options: PageOptions,
) {
  const palette = document.studio.palettes?.find((entry) => entry.id === id);
  if (!palette) throw new CodeboardError("INVALID_ARGUMENT", `Palette not found: ${id}`);
  const { offset, limit } = pageBounds(options);
  return structuredClone(boundQueryResponse(palette.swatches.slice(offset, offset + limit)));
}

export function readBrush(document: StoryboardDocument, id: Id) {
  const brush = document.brushes.find((entry) => entry.id === id);
  if (!brush) throw new CodeboardError("INVALID_ARGUMENT", `Brush not found: ${id}`);
  return structuredClone(brush);
}

export function readLayer(document: StoryboardDocument, id: Id): Layer {
  return structuredClone(findDocumentLayer(document, id));
}

export function readLayerKeyframes(document: StoryboardDocument, id: Id, options: PageOptions) {
  const { limit, offset } = pageBounds(options);
  return structuredClone(
    boundQueryResponse(
      [...findDocumentLayer(document, id).keyframes]
        .sort((a, b) => a.frame - b.frame)
        .slice(offset, offset + limit),
    ),
  );
}

export function readTwoBoneRig(document: StoryboardDocument, id: Id) {
  const layer = findDocumentLayer(document, id);
  if (layer.kind !== "group")
    throw new CodeboardError("INVALID_ARGUMENT", `Rig requires a group: ${id}`);
  return structuredClone(layer.twoBoneRig ?? null);
}

export function readDrawingSequence(document: StoryboardDocument, id: Id) {
  const layer = findDocumentLayer(document, id);
  if (layer.kind !== "group")
    throw new CodeboardError("INVALID_ARGUMENT", `Drawing sequence requires a group: ${id}`);
  return {
    keys: structuredClone(layer.drawingSequence ?? null),
    drawings: layer.children.map(({ id, name, kind }) => ({ id, name, kind })),
  };
}

export function readDrawingExposures(document: StoryboardDocument, id: Id, options: PageOptions) {
  const { offset, limit } = pageBounds(options);
  const layer = findDocumentLayer(document, id);
  if (layer.kind !== "group")
    throw new CodeboardError("INVALID_ARGUMENT", `Drawing sequence requires a group: ${id}`);
  if (layer.drawingSequence === undefined) return null;
  return structuredClone(
    boundQueryResponse(layer.drawingSequence.slice(offset, offset + limit), "Drawing exposures"),
  );
}

export function readDrawingAlternatives(
  document: StoryboardDocument,
  id: Id,
  options: PageOptions,
) {
  const { offset, limit } = pageBounds(options);
  const layer = findDocumentLayer(document, id);
  if (layer.kind !== "group")
    throw new CodeboardError("INVALID_ARGUMENT", `Drawing alternatives require a group: ${id}`);
  return boundQueryResponse(
    layer.children.slice(offset, offset + limit).map(({ id, name, kind }) => ({ id, name, kind })),
    "Drawing alternatives",
  );
}

export function readDrawingNeighbors(
  document: StoryboardDocument,
  id: Id,
  frame: number,
  skipBlank: boolean,
) {
  const panel = document.panels.find((panel) =>
    allLayers(panel.layers).some((layer) => layer.id === id),
  );
  if (!panel) {
    for (const animation of document.studio.animations) {
      const layer = locateLayer(animation.layers, id)?.layer;
      if (!layer) continue;
      if (layer.kind !== "group" || layer.drawingSequence === undefined)
        throw new CodeboardError("INVALID_ARGUMENT", `Layer is not a drawing sequence: ${id}`);
      return drawingNeighbors(layer.drawingSequence, frame, 0, animation.durationFrames, skipBlank);
    }
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      `Drawing track not found in board or shot animation: ${id}`,
    );
  }
  const layer = findPanelLayer(panel, id);
  if (layer.kind !== "group" || layer.drawingSequence === undefined)
    throw new CodeboardError("INVALID_ARGUMENT", `Layer is not a drawing sequence: ${id}`);
  return drawingNeighbors(
    layer.drawingSequence,
    frame,
    panel.startFrame,
    panel.startFrame + panel.durationFrames,
    skipBlank,
  );
}

export function readElement(document: StoryboardDocument, id: Id): DrawingElement {
  for (const owner of [...document.panels, ...document.components, ...document.studio.animations]) {
    for (const layer of iterateLayers(owner.layers)) {
      if (layer.kind === "group") continue;
      const element = layer.elements.find((entry) => entry.id === id);
      if (element) return structuredClone(element);
    }
  }
  throw new CodeboardError("INVALID_ARGUMENT", `Drawing element not found: ${id}`);
}
