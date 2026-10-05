import { validateTwoBoneRig } from "./rig.js";
import type { GroupLayer, Layer } from "../types.js";
import { validateBrushResources } from "./brushes.js";
import { allLayers as identityLayers } from "../layers.js";
import { validateEffectValues } from "./effects.js";
import { validateKeyframePositions } from "./keyframes.js";
export { validateKeyframePositions } from "./keyframes.js";

export function validateLayerEffectKeys(layer: Layer): void {
  for (const key of layer.keyframes)
    validateEffectValues(layer.effects ?? [], key.effectValues ?? [], {
      layerId: layer.id,
      keyId: key.id,
    });
}
export function validateLayerDependencies(layers: ReadonlyMap<string, Layer>): void {
  const visiting = new Set<string>(),
    visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error(`Circular layer dependency: ${id}`);
    if (visited.has(id)) return;
    const layer = layers.get(id);
    if (!layer) throw new Error(`Missing layer dependency: ${id}`);
    visiting.add(id);
    if (layer.maskLayerId !== undefined) visit(layer.maskLayerId);
    if (layer.kind === "group") for (const child of layer.children) visit(child.id);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of layers.keys()) visit(id);
}

export function validateDrawingSequence(layer: GroupLayer): void {
  if (layer.drawingSequence === undefined) return;
  if (layer.twoBoneRig)
    throw new Error("Unbind the two-bone rig before selecting drawing alternatives at its root");
  const ids = new Set(layer.children.map((child) => child.id));
  for (const key of layer.drawingSequence)
    if (key.drawingId !== null && !ids.has(key.drawingId))
      throw new Error(
        `Drawing exposure in ${layer.id} references a non-child layer: ${key.drawingId}`,
      );
  if (layer.children.some((child) => child.clipToBelow))
    throw new Error(
      `Drawing alternatives in ${layer.id} cannot clip to another alternative; put clipping layers inside a drawing group`,
    );
}

export function validateArtwork(entries: Layer[]): void {
  const layers = new Map(identityLayers(entries).map((layer) => [layer.id, layer]));
  validateLayerDependencies(layers);
  for (const layer of layers.values()) {
    if (!entries.includes(layer) && layer.keyframes.some((key) => key.depth !== undefined))
      throw new Error(`Depth keyframes require a top-level plane: ${layer.id}`);
    validateKeyframePositions(layer.keyframes, layer.id);
    validateLayerEffectKeys(layer);
    if (layer.kind === "group" && layer.twoBoneRig) validateTwoBoneRig(layer, layer.twoBoneRig);
    if (layer.kind === "group") validateDrawingSequence(layer);
    if (layer.kind !== "group")
      for (const element of layer.elements) {
        if (
          (element.kind === "raster-stroke" || element.kind === "raster-surface") !==
          (layer.kind === "raster")
        )
          throw new Error(`Element ${element.id} is incompatible with ${layer.kind} layer`);
        if (element.kind === "raster-stroke") {
          validateBrushResources(element.brush, element.id);
          for (let i = 1; i < element.points.length; i++)
            if ((element.points[i]!.time ?? 0) < (element.points[i - 1]!.time ?? 0))
              throw new Error(`Stroke ${element.id} has decreasing pen timestamps`);
        }
      }
  }
}
