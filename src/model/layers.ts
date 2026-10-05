import {
  identityTransform,
  type Id,
  type Panel,
  type Layer,
  type DrawingLayer,
  type StoryboardDocument,
  type LayerOptions,
  type Transform,
  type BlendMode,
} from "./types.js";
import { CodeboardError } from "./errors.js";

export function findPanel(document: StoryboardDocument, id: Id): Panel {
  const panel = document.panels.find((entry) => entry.id === id);
  if (!panel)
    throw new CodeboardError("INVALID_ARGUMENT", `Panel not found: ${id}`, {
      details: { reason: "missing-owner", ownerType: "panel", ownerId: id },
    });
  return panel;
}

export function* iterateLayers(layers: readonly Layer[]): Generator<Layer> {
  for (const layer of layers) {
    yield layer;
    if (layer.kind === "group") yield* iterateLayers(layer.children);
  }
}

export function visitLayers(layers: Layer[], work: (layer: Layer) => void): void {
  for (const layer of iterateLayers(layers)) work(layer);
}

export function findLayer(document: StoryboardDocument, id: Id): { panel: Panel; layer: Layer } {
  for (const panel of document.panels) {
    let found: Layer | undefined;
    visitLayers(panel.layers, (layer) => {
      if (layer.id === id) found = layer;
    });
    if (found) return { panel, layer: found };
  }
  throw new Error(`Layer not found: ${id}`);
}

export function cloneLayers(layers: Layer[], nextId: (prefix: string) => Id): Layer[] {
  return cloneLayersWithIdentities(layers, nextId).layers;
}

/** Record identity correspondence at allocation time, before remapping internal references. */
export function cloneLayersWithIdentities(layers: Layer[], nextId: (prefix: string) => Id) {
  const originals: Layer[] = [];
  visitLayers(layers, (layer) => originals.push(layer));
  const owned = new Set(originals.map((layer) => layer.id));
  if (owned.size !== originals.length)
    throw new CodeboardError("INVALID_ARGUMENT", "Copied layers must have unique source IDs", {
      details: { reason: "COPY_DUPLICATE_LAYER_ID" },
    });
  for (const layer of originals) {
    if (layer.maskLayerId && !owned.has(layer.maskLayerId))
      throw new CodeboardError("INVALID_ARGUMENT", "Copy must include the mask dependency", {
        details: {
          reason: "COPY_MASK_DEPENDENCY",
          layerId: layer.id,
          targetId: layer.maskLayerId,
        },
      });
    if (layer.kind !== "group") continue;
    if (
      layer.twoBoneRig &&
      !layer.children.some(
        (child) => child.id === layer.twoBoneRig!.elbowId && child.kind === "group",
      )
    )
      throw new CodeboardError("INVALID_ARGUMENT", "Copy requires an immediate child rig elbow", {
        details: {
          reason: "COPY_RIG_ELBOW",
          layerId: layer.id,
          targetId: layer.twoBoneRig.elbowId,
        },
      });
    const childIds = new Set(layer.children.map((child) => child.id));
    for (const key of layer.drawingSequence ?? [])
      if (key.drawingId !== null && !childIds.has(key.drawingId))
        throw new CodeboardError("INVALID_ARGUMENT", "Copy requires child drawing references", {
          details: {
            reason: "COPY_DRAWING_REFERENCE",
            layerId: layer.id,
            targetId: key.drawingId,
            frame: key.frame,
          },
        });
  }
  const sourceIds = new Set<Id>();
  const source = (id: Id) => {
    if (!id || id.length > 4096 || sourceIds.has(id))
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Copied objects require unique valid source IDs",
        {
          details: { reason: "COPY_SOURCE_ID", sourceId: id },
        },
      );
    sourceIds.add(id);
  };
  for (const layer of originals) {
    source(layer.id);
    for (const key of layer.keyframes) source(key.id);
    if (layer.kind !== "group") for (const element of layer.elements) source(element.id);
  }
  const copied = structuredClone(layers),
    ids = new Map<Id, Id>();
  const allocated = new Set<Id>();
  const identities: { sourceId: Id; copyId: Id }[] = [];
  const allocate = (sourceId: Id, prefix: string): Id => {
    const copyId = nextId(prefix);
    if (
      typeof copyId !== "string" ||
      !copyId.length ||
      copyId.length > 4096 ||
      allocated.has(copyId) ||
      sourceIds.has(copyId)
    )
      throw new CodeboardError("INVALID_ARGUMENT", "Copy allocator must return fresh unique IDs", {
        details: { reason: "COPY_DESTINATION_ID", sourceId, copyId },
      });
    allocated.add(copyId);
    identities.push({ sourceId, copyId });
    ids.set(sourceId, copyId);
    return copyId;
  };
  visitLayers(copied, (layer) => {
    layer.id = allocate(layer.id, "layer");
    for (const key of layer.keyframes) key.id = allocate(key.id, "layer-key");
    if (layer.kind !== "group")
      for (const element of layer.elements) element.id = allocate(element.id, "element");
  });
  visitLayers(copied, (layer) => {
    if (layer.maskLayerId) layer.maskLayerId = ids.get(layer.maskLayerId)!;
    if (layer.kind === "group" && layer.twoBoneRig)
      layer.twoBoneRig.elbowId = ids.get(layer.twoBoneRig.elbowId)!;
    if (layer.kind === "group")
      for (const key of layer.drawingSequence ?? [])
        if (key.drawingId !== null) key.drawingId = ids.get(key.drawingId)!;
  });
  return { layers: copied, identities };
}

export function layerBase(id: string, name: string, options: LayerOptions) {
  const transform: Transform = { ...identityTransform(), ...options.transform };
  return {
    id,
    name,
    visible: options.visible ?? true,
    opacity: options.opacity ?? 1,
    blendMode: options.blendMode ?? ("source-over" as BlendMode),
    transform,
    ...(options.pivot ? { pivot: structuredClone(options.pivot) } : {}),
    ...(options.effects === undefined ? {} : { effects: structuredClone(options.effects) }),
    ...(options.maskLayerId ? { maskLayerId: options.maskLayerId } : {}),
    clipToBelow: options.clipToBelow ?? false,
    keyframes: [],
    depth: options.depth ?? 1,
    exposure: structuredClone(options.exposure ?? null),
  };
}

export function allLayers(layers: Layer[]): Layer[] {
  return [...iterateLayers(layers)];
}

export function findDocumentLayer(document: StoryboardDocument, id: Id): Layer {
  for (const owner of [...document.panels, ...document.components, ...document.studio.animations]) {
    for (const layer of iterateLayers(owner.layers)) if (layer.id === id) return layer;
  }
  throw new Error(`Layer not found: ${id}`);
}

/** Locate authored instance artwork, excluding component library source snapshots. */
export function findLiveLayer(document: StoryboardDocument, id: Id) {
  for (const panel of document.panels)
    for (const layer of iterateLayers(panel.layers))
      if (layer.id === id) return { kind: "panel" as const, owner: panel, layer };
  for (const animation of document.studio.animations)
    for (const layer of iterateLayers(animation.layers))
      if (layer.id === id) return { kind: "animation" as const, owner: animation, layer };
  throw new Error(`Live layer not found: ${id}`);
}

export function findPanelLayer(panel: Panel, layerId: Id): Layer {
  for (const layer of iterateLayers(panel.layers)) if (layer.id === layerId) return layer;
  throw new Error(`Layer not found: ${layerId}`);
}

export function findDrawingLayer(panel: Panel, layerId: Id): DrawingLayer {
  const layer = findPanelLayer(panel, layerId);
  if (layer.kind === "group") throw new Error(`Layer ${layerId} is a group, not a drawing layer`);
  return layer;
}
