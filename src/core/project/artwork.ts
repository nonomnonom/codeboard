import {
  layerBase,
  allLayers,
  findPanelLayer as findLayer,
  findDrawingLayer,
} from "../../model/layers.js";
import { validateRigLayerChange } from "../../model/validation/rig.js";
import type {
  DrawingElement,
  Id,
  Layer,
  LayerChanges,
  LayerOptions,
  MotionAnnotation,
  NewDrawingElement,
  StoryboardDocument,
} from "../../model/types.js";
import { layerChangesSchema } from "../../model/schema/layers.js";
import {
  validateLayerEffectKeys,
  validateLayerDependencies,
} from "../../model/validation/artwork.js";
import { removeReviewAnchors } from "../../model/review.js";
import { assertDrawingColors } from "../../drawing/color.js";
import { findPanel } from "../../model/layers.js";

export function addLayer(
  document: StoryboardDocument,
  nextId: (prefix: string) => Id,
  panelId: Id,
  kind: "raster" | "vector" | "group",
  name: string,
  options: LayerOptions,
  parentGroupId?: Id,
): Id {
  const panel = findPanel(document, panelId);
  let siblings = panel.layers;
  if (parentGroupId) {
    const group = findLayer(panel, parentGroupId);
    if (group.kind !== "group") throw new Error(`Parent ${parentGroupId} is not a group`);
    siblings = group.children;
  }
  const requestedId = options.id;
  const base = layerBase(requestedId ?? "", name, options);
  const id = requestedId ?? nextId("layer");
  const layer: Layer =
    kind === "group" ? { ...base, id, kind, children: [] } : { ...base, id, kind, elements: [] };
  siblings.push(layer);
  panel.revision += 1;

  return id;
}

export function addElement(
  document: StoryboardDocument,
  nextId: (prefix: string) => Id,
  panelId: Id,
  layerId: Id,
  element: NewDrawingElement,
): Id {
  let id = "";
  const panel = findPanel(document, panelId);
  const layer = findDrawingLayer(panel, layerId);
  const raster = element.kind === "raster-stroke" || element.kind === "raster-surface";
  if (raster !== (layer.kind === "raster"))
    throw new Error(`${element.kind} requires a ${raster ? "raster" : "vector"} layer`);
  id = element.id ?? nextId("element");
  layer.elements.push({ ...element, id } as DrawingElement);
  panel.revision += 1;

  return id;
}

export function addMotion(
  document: StoryboardDocument,
  nextId: (prefix: string) => Id,
  panelId: Id,
  annotation: Omit<MotionAnnotation, "id"> & { id?: Id },
): Id {
  const panel = findPanel(document, panelId);
  const prepared = structuredClone(annotation);
  const id = prepared.id ?? nextId("motion");
  panel.motion.push({ ...prepared, id });
  panel.revision += 1;

  return id;
}

export function updateLayer(
  document: StoryboardDocument,
  panelId: Id,
  layerId: Id,
  changes: LayerChanges,
): void {
  const panel = findPanel(document, panelId);
  const layer = findLayer(panel, layerId);
  const { maskLayerId, ...parsed } = layerChangesSchema.parse(changes);
  const properties = Object.fromEntries(
    Object.entries(parsed).filter(([, value]) => value !== undefined),
  );
  if (maskLayerId !== undefined && maskLayerId !== null) {
    const dependencies = new Map(allLayers(panel.layers).map((entry) => [entry.id, entry]));
    dependencies.set(layerId, { ...layer, maskLayerId });
    validateLayerDependencies(dependencies);
  }
  validateRigLayerChange(panel.layers, { ...layer, ...properties });
  validateLayerEffectKeys({ ...layer, ...properties });
  Object.assign(layer, properties);
  if (maskLayerId === null) delete layer.maskLayerId;
  else if (maskLayerId !== undefined) layer.maskLayerId = maskLayerId;
  panel.revision += 1;
}

export function updateElements(
  document: StoryboardDocument,
  panelId: Id,
  layerId: Id,
  selected: ReadonlySet<Id>,
  updater: (element: DrawingElement) => DrawingElement,
): void {
  const panel = findPanel(document, panelId);
  const layer = findDrawingLayer(panel, layerId);
  const existing = new Set(layer.elements.map((e) => e.id));
  for (const id of selected) if (!existing.has(id)) throw new Error(`Element not found: ${id}`);
  const updated = layer.elements.map((original) => {
    if (!selected.has(original.id)) return original;
    const result = updater(structuredClone(original));
    if (result.id !== original.id)
      throw new Error("Editing an element may not change its stable id");
    assertDrawingColors(result);
    return structuredClone(result);
  });
  layer.elements = updated;
  panel.revision += 1;
}

export function remove(
  document: StoryboardDocument,
  panelId: Id,
  layerId?: Id,
  elementIds: Id[] = [],
): void {
  const panel = findPanel(document, panelId);
  if (!layerId) throw new Error("Selection.remove() requires a layerId");
  const layer = findDrawingLayer(panel, layerId);
  const existing = new Set(layer.elements.map((e) => e.id));
  for (const id of elementIds) if (!existing.has(id)) throw new Error(`Element not found: ${id}`);
  const before = layer.elements.length;
  layer.elements = layer.elements.filter((element) => !elementIds.includes(element.id));
  if (layer.elements.length === before) throw new Error("Selection did not match any elements");
  removeReviewAnchors(document, new Set(elementIds));
  panel.revision += 1;
}
