import type { Layer, DrawingLayer, GroupLayer } from "../../model/types.js";
import { CodeboardError } from "../../model/errors.js";
import { planShotElement, readPlanShotElement, type PlanDrawingElement } from "./artwork.js";

export type PlanStudioLayer =
  | (Omit<GroupLayer, "children"> & { children: PlanStudioLayer[] })
  | (Omit<DrawingLayer, "elements"> & { elements: PlanDrawingElement[] });

/** The caller owns domain validation and depth/size preflight. */
export function encodePlanLayer(layer: Layer): PlanStudioLayer {
  return layer.kind === "group"
    ? { ...layer, children: layer.children.map(encodePlanLayer) }
    : { ...layer, elements: layer.elements.map(planShotElement) };
}

export function decodePlanLayer(value: unknown): unknown {
  if (!value || typeof value !== "object" || !("kind" in value))
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid planned layer");
  if (value.kind === "group") {
    if (!("children" in value) || !Array.isArray(value.children))
      throw new CodeboardError("INVALID_ARGUMENT", "Planned group requires children");
    return { ...value, children: value.children.map(decodePlanLayer) };
  }
  if (!("elements" in value) || !Array.isArray(value.elements))
    throw new CodeboardError("INVALID_ARGUMENT", "Planned drawing layer requires elements");
  return { ...value, elements: value.elements.map(readPlanShotElement) };
}
