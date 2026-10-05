import type { ShotAnimation } from "../model/types/shot.js";
import { shotAnimationSchema } from "../model/schema/shot.js";
import { validateArtwork, validateKeyframePositions } from "../model/validation/artwork.js";
import { allLayers } from "../model/layers.js";
import { CodeboardError } from "../model/errors.js";
import { validateShotControllers } from "./controllers.js";
import { createBoundMeshEvaluator } from "./mesh-binding.js";
import { validateCompositeSources } from "../model/validation/compositing.js";

export function defineShotAnimation(input: unknown): ShotAnimation {
  const parsed = shotAnimationSchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid shot animation", {
      details: { issues: parsed.error.issues },
    });
  const animation = structuredClone(parsed.data) as ShotAnimation;
  validateArtwork(animation.layers);
  validateShotControllers(animation);
  const layerIds = new Set(allLayers(animation.layers).map((layer) => layer.id));
  if (animation.compositing)
    validateCompositeSources(animation.compositing, layerIds, animation.id);
  const boundLayers = new Set<string>();
  for (const binding of animation.meshes ?? []) {
    const { layerId, mesh } = binding;
    if (
      !layerIds.has(layerId) ||
      boundLayers.has(layerId) ||
      (mesh !== undefined && !mesh.triangles.length)
    )
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Mesh binding requires a unique existing layer and nonempty geometry",
        {
          details: { reason: "SHOT_MESH_BINDING", animationId: animation.id, layerId },
        },
      );
    boundLayers.add(layerId);
    try {
      createBoundMeshEvaluator(binding, animation);
    } catch (cause) {
      if (cause instanceof CodeboardError)
        throw new CodeboardError(cause.code, cause.message, {
          details: { ...cause.details, animationId: animation.id, layerId },
          cause,
        });
      throw cause;
    }
  }
  validateKeyframePositions(animation.cameraKeyframes, animation.id);
  const ids = new Set<string>([animation.id]);
  const insert = (id: string) => {
    if (!id || id.length > 4096)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Animation object IDs must contain 1–4096 characters",
      );
    if (ids.has(id)) throw new CodeboardError("INVALID_ARGUMENT", `Duplicate animation ID: ${id}`);
    ids.add(id);
  };
  for (const layer of allLayers(animation.layers)) {
    insert(layer.id);
    for (const key of layer.keyframes) insert(key.id);
    if (layer.kind !== "group") for (const element of layer.elements) insert(element.id);
  }
  for (const controller of animation.controllers ?? []) insert(controller.id);
  for (const key of animation.cameraKeyframes) insert(key.id);
  for (const track of animation.audio ?? []) {
    insert(track.id);
    for (const clip of track.clips) insert(clip.id);
  }
  return animation;
}
