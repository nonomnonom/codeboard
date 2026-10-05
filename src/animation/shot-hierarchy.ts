import { locateLayer, layerChildren, insertLayer, moveLayerTree } from "../model/layer-tree.js";
import { layerBase } from "../model/layers.js";
import { CodeboardError } from "../model/errors.js";
import type { ShotAnimation, ShotAnimationEdit } from "../model/types/shot.js";

type HierarchyEdit = Extract<
  ShotAnimationEdit,
  { op: "layer.add" | "layer.move" | "layer.remove" }
>;

/** Mutate an isolated shot draft; the batch owner validates its final references. */
export function applyShotHierarchyEdit(result: ShotAnimation, edit: HierarchyEdit): void {
  switch (edit.op) {
    case "layer.add": {
      if (locateLayer(result.layers, edit.id))
        throw new CodeboardError("INVALID_ARGUMENT", `Duplicate layer ID: ${edit.id}`);
      const base = layerBase(edit.id, edit.name, edit.options ?? {});
      const created =
        edit.kind === "group"
          ? { ...base, kind: "group" as const, children: [] }
          : { ...base, kind: edit.kind, elements: [] };
      insertLayer(layerChildren(result.layers, edit.parentId ?? null), created, edit.beforeId);
      break;
    }
    case "layer.move":
      moveLayerTree(result.layers, edit.layerId, edit.parentId, edit.beforeId);
      break;
    case "layer.remove": {
      const found = locateLayer(result.layers, edit.layerId);
      if (!found) throw new CodeboardError("INVALID_ARGUMENT", `Layer not found: ${edit.layerId}`);
      found.siblings.splice(found.index, 1);
      break;
    }
  }
}
