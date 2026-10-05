import { reviseStudioAudio } from "../../audio/edit.js";
import { findStudioAudioOwner } from "../../model/studio.js";
import type { StoryboardDocument, DrawingElement, PixelBuffer } from "../../model/types.js";
import type { ShotAnimation } from "../../model/types/shot.js";
import type { EditorialSequence } from "../../model/types/editorial.js";
import { CodeboardError } from "../../model/errors.js";
import { allLayers } from "../../model/layers.js";
import { writePixelRegion } from "../../drawing/pixel-buffer.js";

function artwork(document: StoryboardDocument, animationId: string, layerId: string) {
  const animation = document.studio.animations.find((item) => item.id === animationId);
  if (!animation)
    throw new CodeboardError("INVALID_ARGUMENT", `Shot animation not found: ${animationId}`);
  const layer = allLayers(animation.layers).find((item) => item.id === layerId);
  if (!layer || layer.kind === "group")
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      `Drawing layer not found in animation: ${layerId}`,
    );
  return layer;
}

export function reviseShotElement(
  document: StoryboardDocument,
  animationId: string,
  layerId: string,
  id: string,
  element: DrawingElement,
): void {
  const layer = artwork(document, animationId, layerId),
    index = layer.elements.findIndex((item) => item.id === id);
  if (index < 0) throw new CodeboardError("INVALID_ARGUMENT", `Shot element not found: ${id}`);
  if (element.id !== id)
    throw new CodeboardError("INVALID_ARGUMENT", "A shot element revision must preserve its ID");
  layer.elements[index] = structuredClone(element);
}

export function patchShotPixels(
  document: StoryboardDocument,
  animationId: string,
  layerId: string,
  id: string,
  x: number,
  y: number,
  patch: PixelBuffer,
): void {
  const element = artwork(document, animationId, layerId).elements.find((item) => item.id === id);
  if (element?.kind !== "raster-surface")
    throw new CodeboardError("INVALID_ARGUMENT", `Shot pixel surface not found: ${id}`);
  writePixelRegion(element, x, y, patch);
}

export function putShotAnimation(document: StoryboardDocument, animation: ShotAnimation): void {
  const index = document.studio.animations.findIndex((item) => item.id === animation.id);
  if (index < 0) document.studio.animations.push(animation);
  else document.studio.animations[index] = animation;
}

export function putEditorialSequence(
  document: StoryboardDocument,
  sequence: EditorialSequence,
): void {
  const index = document.studio.editorial.findIndex((item) => item.id === sequence.id);
  if (index < 0) document.studio.editorial.push(sequence);
  else document.studio.editorial[index] = sequence;
}

export function removeStudioObject(
  document: StoryboardDocument,
  kind: "animation" | "editorial",
  id: string,
): void {
  const entries = kind === "animation" ? document.studio.animations : document.studio.editorial;
  const index = entries.findIndex((item) => item.id === id);
  if (index < 0) throw new CodeboardError("INVALID_ARGUMENT", `Studio ${kind} not found: ${id}`);
  entries.splice(index, 1);
}

export function setStudioAudio(
  document: StoryboardDocument,
  ownerId: string,
  tracks: import("../../model/types/studio-audio.js").StudioAudioTrack[],
): void {
  const owner = findStudioAudioOwner(document, ownerId);
  owner.audio = tracks;
}

export function editStudioAudio(
  document: StoryboardDocument,
  ownerId: string,
  edits: readonly import("../../model/types/studio-audio.js").StudioAudioEdit[],
): void {
  const owner = findStudioAudioOwner(document, ownerId);
  owner.audio = reviseStudioAudio(owner.audio ?? [], edits);
}

export function addShotElement(
  document: StoryboardDocument,
  animationId: string,
  layerId: string,
  element: DrawingElement,
): void {
  artwork(document, animationId, layerId).elements.push(structuredClone(element));
}
export function removeShotElements(
  document: StoryboardDocument,
  animationId: string,
  layerId: string,
  ids: readonly string[],
): void {
  const target = artwork(document, animationId, layerId),
    selected = new Set(ids);
  if (
    !ids.length ||
    selected.size !== ids.length ||
    ids.some((id) => !target.elements.some((element) => element.id === id))
  )
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Element removal requires unique existing IDs in the selected layer",
    );
  target.elements = target.elements.filter((element) => !selected.has(element.id));
}
