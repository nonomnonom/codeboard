import { z } from "zod";
import type { StoryboardDocument } from "../../model/types.js";
import { cloneShotArtwork } from "../../animation/clone-shot-artwork.js";
import { copyComponentOrigins } from "../../model/component-origins.js";
import { defineShotAnimation } from "../../animation/shot.js";
import { CodeboardError } from "../../model/errors.js";

export interface ShotDuplicateOptions {
  id: string;
  shotId: string;
  name?: string;
}
export interface ShotDuplicateResult {
  animationId: string;
  sourceAnimationId: string;
  identities: { sourceId: string; copyId: string }[];
}
const id = z.string().min(1).max(4096);
const optionsSchema = z.object({ id, shotId: id, name: z.string().optional() }).strict();

/** Duplicate complete local shot content; shared project resources keep their existing IDs. */
export function duplicateShotAnimation(
  document: StoryboardDocument,
  nextId: (prefix: string) => string,
  sourceAnimationId: string,
  input: ShotDuplicateOptions,
): ShotDuplicateResult {
  const parsed = optionsSchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid shot duplication options");
  const options = parsed.data;
  const source = document.studio.animations.find((entry) => entry.id === sourceAnimationId);
  if (!source) throw new CodeboardError("INVALID_ARGUMENT", "Source animation not found");
  if (document.studio.animations.some((entry) => entry.id === options.id))
    throw new CodeboardError("INVALID_ARGUMENT", "Duplicate requires a new animation ID");
  if (!document.shots.some((entry) => entry.id === options.shotId))
    throw new CodeboardError("INVALID_ARGUMENT", "Destination shot not found");
  const copied = cloneShotArtwork(source, nextId);
  const identities = [{ sourceId: source.id, copyId: options.id }, ...copied.identities];
  const layerIds = new Map(copied.identities.map((entry) => [entry.sourceId, entry.copyId]));
  const mappedLayer = (sourceId: string) => {
    const copyId = layerIds.get(sourceId);
    if (!copyId)
      throw new CodeboardError("INVALID_ARGUMENT", "Copied shot has an external layer dependency", {
        details: { sourceId },
      });
    return copyId;
  };
  const allocate = (sourceId: string, prefix: string) => {
    const copyId = nextId(prefix);
    identities.push({ sourceId, copyId });
    return copyId;
  };
  const { layers: _layers, meshes: _meshes, controllers: _controllers, ...metadata } = source;
  const animation = {
    ...structuredClone(metadata),
    layers: copied.layers,
    ...(copied.meshes === undefined ? {} : { meshes: copied.meshes }),
    ...(copied.controllers === undefined ? {} : { controllers: copied.controllers }),
  };
  animation.id = options.id;
  animation.shotId = options.shotId;
  animation.name = options.name ?? source.name;
  animation.boardPanelIds = [];
  animation.cameraKeyframes = animation.cameraKeyframes.map((key) => ({
    ...key,
    id: allocate(key.id, "camera-key"),
  }));
  for (const node of animation.compositing?.nodes ?? [])
    if (node.kind === "source") node.layerIds = node.layerIds.map(mappedLayer);
  for (const track of animation.audio ?? []) {
    track.id = allocate(track.id, "audio-track");
    for (const clip of track.clips) clip.id = allocate(clip.id, "audio-clip");
  }
  const validated = defineShotAnimation(animation);
  document.studio.animations.push(validated);
  copyComponentOrigins(document, copied, nextId);
  return { animationId: validated.id, sourceAnimationId, identities };
}
