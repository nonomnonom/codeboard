import type { CanvasRenderingContext2D } from "skia-canvas";
import type { Layer, Panel } from "../model/types.js";
import { findLayerPath } from "../model/layer-tree.js";
import { evaluateLayer, evaluateDrawing } from "../animation/evaluate.js";
import type { CompositionBounds } from "./composition-bounds.js";
import { placeLayer, placeSurface, type RenderMatrix } from "./placement.js";
import type { IndexedMeshWarp } from "../animation/mesh-warp.js";
import { CodeboardError } from "../model/errors.js";

/** Resolve the mask in panel space without applying shared ancestor opacity twice. */
export function resolveLayerMask(
  panel: Panel,
  layer: Layer,
  frame: number,
  ctx: CanvasRenderingContext2D,
  resolution: number,
  bounds: CompositionBounds,
  panelToSurface?: RenderMatrix,
  meshPoses?: ReadonlyMap<string, IndexedMeshWarp>,
) {
  const maskPath = findLayerPath(panel.layers, layer.maskLayerId!);
  if (!maskPath) throw new Error(`Mask layer not found: ${layer.maskLayerId}`);
  const mask = maskPath.at(-1)!;
  const consumerAncestors = new Set(
    findLayerPath(panel.layers, layer.id)!
      .slice(0, -1)
      .map((entry) => entry.id),
  );
  const maskAncestors = new Set(maskPath.slice(0, -1).map((entry) => entry.id));
  for (const ancestorId of consumerAncestors)
    if (meshPoses?.has(ancestorId) && !maskAncestors.has(ancestorId))
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Mask is outside the consumer's deformed ancestor",
        {
          details: {
            reason: "MESH_EXTERNAL_CONSUMER_ANCESTOR",
            layerId: layer.id,
            maskId: mask.id,
            ancestorId,
          },
        },
      );
  let maskOpacity = evaluateLayer(mask, frame).opacity;
  for (const ancestor of maskPath.slice(0, -1))
    if (meshPoses?.has(ancestor.id) && !consumerAncestors.has(ancestor.id))
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Mask crosses an independently deformed ancestor",
        {
          details: {
            reason: "MESH_EXTERNAL_MASK_ANCESTOR",
            layerId: layer.id,
            maskId: mask.id,
            ancestorId: ancestor.id,
          },
        },
      );
  ctx.save();
  try {
    placeSurface(ctx, resolution, bounds, panelToSurface);
    for (const [index, ancestor] of maskPath.slice(0, -1).entries()) {
      const state = evaluateLayer(ancestor, frame);
      placeLayer(ctx, state.transform, ancestor.pivot);
      if (!consumerAncestors.has(ancestor.id)) maskOpacity *= state.opacity;
      if (
        ancestor.exposure &&
        (frame < ancestor.exposure.startFrame || frame >= ancestor.exposure.endFrame)
      )
        maskOpacity = 0;
      if (ancestor.kind === "group") {
        const drawing = evaluateDrawing(ancestor.drawingSequence, frame);
        if (drawing !== undefined && drawing !== maskPath[index + 1]!.id) maskOpacity = 0;
      }
    }
    const maskParent = ctx.getTransform();
    return { mask, maskParent, maskOpacity };
  } finally {
    ctx.restore();
  }
}
