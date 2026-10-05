import type { ShotAnimation } from "../model/types/shot.js";
import { createLayerSkinEvaluator } from "./layer-skin.js";
import type { ShotMeshBinding } from "../model/types/deformation.js";
import { createCurveMeshEvaluator } from "./curve-mesh.js";
import { createMeshAnimationEvaluator } from "./mesh-animation.js";
import { bakeEnvelopeMesh } from "./envelope-mesh.js";

export function createBoundMeshEvaluator(binding: ShotMeshBinding, animation: ShotAnimation) {
  if (binding.skin !== undefined)
    return createLayerSkinEvaluator(binding.layerId, binding.skin, animation);
  if (binding.mesh !== undefined) return createMeshAnimationEvaluator(binding.mesh);
  if (binding.curve !== undefined) return createCurveMeshEvaluator(binding.curve);
  return createMeshAnimationEvaluator(bakeEnvelopeMesh(binding.envelope));
}
