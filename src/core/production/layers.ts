import type { DrawingElement, Id, Layer } from "../../model/types.js";
import type { ProductionHost, MutationOptions } from "./host.js";
import { findLayer } from "../../model/layers.js";
import {
  reparentBoardLayer,
  reorderBoardLayer,
  removeBoardLayer,
} from "../../model/board-hierarchy.js";

type Host = Pick<ProductionHost, "_applyProduction" | "_readElement" | "_readLayer">;

export function moveLayer(
  host: Host,
  layerId: Id,
  beforeLayerId?: Id,
  options: MutationOptions = {},
) {
  host._applyProduction(
    "reorder layer",
    [layerId, ...(beforeLayerId ? [beforeLayerId] : [])],
    options.expectedVersion,
    (d) => {
      reorderBoardLayer(d, layerId, beforeLayerId);
    },
    { layerId },
  );
}

export function reparentLayer(
  host: Host,
  layerId: Id,
  parentId: Id | null,
  options: MutationOptions & { beforeLayerId?: Id } = {},
): void {
  host._applyProduction(
    "reparent layer",
    [layerId, ...(parentId ? [parentId] : [])],
    options.expectedVersion,
    (document) => {
      reparentBoardLayer(document, layerId, parentId, options.beforeLayerId);
    },
    { layerId },
  );
}

export function removeLayer(host: Host, layerId: Id, options: MutationOptions = {}) {
  host._applyProduction(
    "remove layer",
    [layerId],
    options.expectedVersion,
    (d) => {
      removeBoardLayer(d, layerId);
    },
    { layerId },
  );
}

export function layer(host: Host, id: Id): Layer {
  return host._readLayer(id);
}

export function element(host: Host, id: Id): DrawingElement {
  return host._readElement(id);
}

export function setPlaneDepth(
  host: Host,
  layerId: Id,
  depth: number,
  options: MutationOptions = {},
): void {
  if (!Number.isFinite(depth) || depth <= 0)
    throw new Error("Plane depth must be positive and finite");
  host._applyProduction(
    "set multiplane depth",
    [layerId],
    options.expectedVersion,
    (d) => {
      const { layer, panel } = findLayer(d, layerId);
      if (!panel.layers.includes(layer))
        throw new Error(
          `Multiplane depth belongs to a top-level layer or group; revise its root plane instead: ${layerId}`,
        );
      layer.depth = depth;
    },
    { layerId },
  );
}
