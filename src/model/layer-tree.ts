import type { Layer } from "./types.js";
import { allLayers } from "./layers.js";
import { CodeboardError } from "./errors.js";

export function locateLayer(
  layers: Layer[],
  id: string,
): { layer: Layer; siblings: Layer[]; index: number } | undefined {
  for (const [index, layer] of layers.entries()) {
    if (layer.id === id) return { layer, siblings: layers, index };
    if (layer.kind === "group") {
      const found = locateLayer(layer.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function layerChildren(layers: Layer[], parentId: string | null): Layer[] {
  if (parentId === null) return layers;
  const parent = locateLayer(layers, parentId)?.layer;
  if (parent?.kind !== "group")
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Layer parent must be a group in the same animation",
    );
  return parent.children;
}

export function insertLayer(siblings: Layer[], layer: Layer, beforeId?: string): void {
  const index =
    beforeId === undefined ? siblings.length : siblings.findIndex((item) => item.id === beforeId);
  if (index < 0)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Layer insertion target must be a destination sibling",
    );
  siblings.splice(index, 0, layer);
}

export function moveLayerTree(
  layers: Layer[],
  id: string,
  parentId: string | null,
  beforeId?: string,
): void {
  const found = locateLayer(layers, id);
  if (!found) throw new CodeboardError("INVALID_ARGUMENT", `Layer not found: ${id}`);
  if (parentId !== null && allLayers([found.layer]).some((layer) => layer.id === parentId))
    throw new CodeboardError("INVALID_ARGUMENT", "A layer cannot parent itself or its descendants");
  const destination = layerChildren(layers, parentId);
  if (beforeId === id && destination === found.siblings) return;
  if (beforeId !== undefined && !destination.some((layer) => layer.id === beforeId))
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Layer insertion target must be a destination sibling",
    );
  found.siblings.splice(found.index, 1);
  insertLayer(destination, found.layer, beforeId);
}

export function findLayerPath(layers: Layer[], id: string): Layer[] | undefined {
  for (const layer of layers) {
    if (layer.id === id) return [layer];
    if (layer.kind === "group") {
      const nested = findLayerPath(layer.children, id);
      if (nested) return [layer, ...nested];
    }
  }
  return undefined;
}
