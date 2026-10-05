import type { Id, Transform, Pivot, Layer, DrawingElement } from "../../model/types.js";
import type { ProjectActions } from "./host.js";
import { matrixFromTransform, multiplyMatrices } from "../../drawing/math.js";

export class Selection {
  constructor(
    private project: ProjectActions,
    private panelId: Id,
    private layerId: Id | undefined,
    private elementIds: Id[],
  ) {
    this.elementIds = [...new Set(elementIds)];
  }

  transform(transform: Partial<Transform>, options: { pivot?: Pivot } = {}): this {
    if (!this.layerId) throw new Error("Selection.transform() requires a layerId");
    if (this.elementIds.length === 0) {
      if (options.pivot)
        throw new Error(
          "A temporary pivot requires selected elements; set the layer pivot for layer animation",
        );
      const panel = this.project.toJSON().panels.find((entry) => entry.id === this.panelId);
      if (!panel) throw new Error(`Panel not found: ${this.panelId}`);
      const current = findLayer(panel.layers, this.layerId).transform;
      this.project._updateLayer(this.panelId, this.layerId, {
        transform: { ...current, ...transform },
      });
      return this;
    }
    this.project._updateElements(this.panelId, this.layerId, this.elementIds, (element) =>
      transformElement(element, transform, options.pivot),
    );
    return this;
  }

  opacity(value: number): this {
    if (!this.layerId) throw new Error("Selection.opacity() requires a layerId");
    if (this.elementIds.length === 0)
      this.project._updateLayer(this.panelId, this.layerId, { opacity: value });
    else
      this.project._updateElements(this.panelId, this.layerId, this.elementIds, (element) => ({
        ...element,
        opacity: value,
      }));
    return this;
  }

  remove(): void {
    this.project._remove(this.panelId, this.layerId, this.elementIds);
  }
}

function findLayer(layers: Layer[], id: Id): Layer {
  for (const layer of layers) {
    if (layer.id === id) return layer;
    if (layer.kind === "group") {
      try {
        return findLayer(layer.children, id);
      } catch {
        /* keep searching */
      }
    }
  }
  throw new Error(`Layer not found: ${id}`);
}

function transformElement(
  element: DrawingElement,
  transform: Partial<Transform>,
  pivot?: Pivot,
): DrawingElement {
  return {
    ...element,
    matrix: multiplyMatrices(
      matrixFromTransform(transform, pivot),
      element.matrix ?? [1, 0, 0, 1, 0, 0],
    ),
  };
}
