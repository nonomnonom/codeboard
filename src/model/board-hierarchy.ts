import type { Id, Layer, StoryboardDocument } from "./types.js";
import { assertRemovalUnlocked } from "./locks.js";
import { removeReviewAnchors } from "./review.js";
import { findLayer, visitLayers } from "./layers.js";
import { findLayerPath } from "./layer-tree.js";
import { validateLayerDependencies } from "./validation/artwork.js";

/** Prepare and validate a replacement hierarchy before publishing it to the panel. */
export function reparentBoardLayer(
  document: StoryboardDocument,
  layerId: Id,
  parentId: Id | null,
  beforeLayerId?: Id,
): void {
  const { panel, layer } = findLayer(document, layerId);
  const sourcePath = findLayerPath(panel.layers, layerId)!,
    destinationPath = parentId === null ? undefined : findLayerPath(panel.layers, parentId),
    destination = destinationPath?.at(-1);
  if (parentId !== null && destination?.kind !== "group")
    throw new Error("Destination must be a group in the same panel, or null for panel root");
  if (parentId !== null && layer.keyframes.some((key) => key.depth !== undefined))
    throw new Error("Remove depth keyframes before nesting a plane beneath another layer");
  const subtree = new Set<Id>();
  visitLayers([layer], (entry) => subtree.add(entry.id));
  if (parentId !== null && subtree.has(parentId))
    throw new Error("Cannot parent a layer to itself or its descendants");
  const affected = new Set([
    ...subtree,
    ...sourcePath.slice(0, -1).map((entry) => entry.id),
    ...(destinationPath?.slice(0, -1).map((entry) => entry.id) ?? []),
    ...(parentId ? [parentId] : []),
  ]);
  const lock = document.locks.find(
    (lock) => lock.targetType === "layer" && affected.has(lock.targetId),
  );
  if (lock)
    throw new Error(`Cannot reparent locked hierarchy: unlock ${lock.targetId} first (${lock.id})`);
  const owner = sourcePath.at(-2),
    oldParent = owner?.id;
  if (oldParent !== parentId && owner?.kind === "group" && owner.twoBoneRig?.elbowId === layerId)
    throw new Error("Unbind the two-bone rig before moving its elbow");
  if (
    oldParent !== parentId &&
    owner?.kind === "group" &&
    owner.drawingSequence?.some((key) => key.drawingId === layerId)
  )
    throw new Error(
      `Drawing sequence ${owner.id} uses ${layerId}; revise its exposures before reparenting`,
    );
  const siblings = destination?.kind === "group" ? destination.children : panel.layers;
  if (
    beforeLayerId !== undefined &&
    (beforeLayerId === layerId || !siblings.some((entry) => entry.id === beforeLayerId))
  )
    throw new Error("Insertion target must be another child of the destination");
  if (
    destination?.kind === "group" &&
    destination.drawingSequence !== undefined &&
    layer.clipToBelow
  )
    throw new Error(
      "A drawing-sequence child cannot clip to another drawing; move its complete clipping group",
    );
  const detach = (layers: Layer[]): Layer[] =>
    layers
      .filter((entry) => entry.id !== layerId)
      .map((entry) =>
        entry.kind === "group" ? { ...entry, children: detach(entry.children) } : entry,
      );
  const insert = (layers: Layer[]): Layer[] => {
    const index =
      beforeLayerId === undefined
        ? layers.length
        : layers.findIndex((entry) => entry.id === beforeLayerId);
    return [...layers.slice(0, index), layer, ...layers.slice(index)];
  };
  const attach = (layers: Layer[]): Layer[] =>
    layers.map((entry) =>
      entry.kind === "group"
        ? {
            ...entry,
            children: entry.id === parentId ? insert(entry.children) : attach(entry.children),
          }
        : entry,
    );
  const detached = detach(panel.layers),
    proposed = parentId === null ? insert(detached) : attach(detached),
    dependencies = new Map<Id, Layer>();
  visitLayers(proposed, (entry) => dependencies.set(entry.id, entry));
  validateLayerDependencies(dependencies);
  panel.layers = proposed;
  panel.revision++;
}

export function reorderBoardLayer(d: StoryboardDocument, layerId: Id, beforeLayerId?: Id): void {
  const { panel } = findLayer(d, layerId);
  const move = (layers: Layer[]): boolean => {
    const index = layers.findIndex((l) => l.id === layerId);
    if (index >= 0) {
      if (beforeLayerId === layerId) return true;
      const destination = beforeLayerId
        ? layers.findIndex((l) => l.id === beforeLayerId)
        : layers.length;
      if (destination < 0) throw new Error("Destination must be a sibling layer");
      const [l] = layers.splice(index, 1);
      layers.splice(destination > index ? destination - 1 : destination, 0, l!);
      return true;
    }
    return layers.some((l) => l.kind === "group" && move(l.children));
  };
  move(panel.layers);
  panel.revision++;
}

export function removeBoardLayer(d: StoryboardDocument, layerId: Id): void {
  const { panel, layer } = findLayer(d, layerId),
    removedLayers = new Set<Id>(),
    removedElements = new Set<Id>();
  visitLayers([layer], (entry) => {
    removedLayers.add(entry.id);
    if (entry.kind !== "group")
      for (const element of entry.elements) removedElements.add(element.id);
  });
  visitLayers(panel.layers, (entry) => {
    if (
      !removedLayers.has(entry.id) &&
      entry.kind === "group" &&
      entry.twoBoneRig &&
      removedLayers.has(entry.twoBoneRig.elbowId)
    )
      throw new Error("Unbind the two-bone rig before removing its elbow");
    if (
      !removedLayers.has(entry.id) &&
      entry.kind === "group" &&
      entry.drawingSequence?.some(
        (key) => key.drawingId !== null && removedLayers.has(key.drawingId),
      )
    )
      throw new Error(
        `Cannot remove ${layerId}: drawing sequence ${entry.id} uses it; revise its exposures first`,
      );
    if (!removedLayers.has(entry.id) && entry.maskLayerId && removedLayers.has(entry.maskLayerId))
      throw new Error(
        `Cannot remove ${layerId}: layer ${entry.id} uses mask ${entry.maskLayerId}; remove or replace its mask reference first`,
      );
  });
  assertRemovalUnlocked(d, removedLayers);
  const remove = (layers: Layer[]): Layer[] =>
    layers
      .filter((l) => l.id !== layerId)
      .map((l) => (l.kind === "group" ? { ...l, children: remove(l.children) } : l));
  panel.layers = remove(panel.layers);
  removeReviewAnchors(d, new Set([...removedLayers, ...removedElements]));
  panel.revision++;
}
