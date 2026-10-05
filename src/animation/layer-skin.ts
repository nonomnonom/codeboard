import type { AffineMatrix, Layer } from "../model/types.js";
import type { LayerSkinInput } from "../model/types/deformation.js";
import type { ShotAnimation } from "../model/types/shot.js";
import { CodeboardError } from "../model/errors.js";
import { findLayerPath } from "../model/layer-tree.js";
import { invertMatrix, matrixFromTransform, multiplyMatrices } from "../drawing/math.js";
import { createControlledLayerEvaluator } from "./controllers.js";
import { createSkinMeshEvaluator } from "./skin-mesh.js";

/** Prepare references in a validated shot snapshot; joint poses are pre-camera transforms. */
export function prepareLayerSkinPoses(
  layerId: string,
  input: LayerSkinInput,
  animation: ShotAnimation,
) {
  const { jointLayers } = input;
  const evaluateLayer = createControlledLayerEvaluator(animation);
  const meshPath = findLayerPath(animation.layers, layerId);
  if (!meshPath)
    throw new CodeboardError("INVALID_ARGUMENT", "Skin layer not found", {
      details: { reason: "SKIN_LAYER_MISSING", layerId },
    });
  const joints = new Set(input.joints.map((joint) => joint.id));
  const seen = new Set<string>();
  const deformed = new Set(animation.meshes?.map((binding) => binding.layerId));
  const paths = jointLayers.map(({ jointId, layerId: jointLayerId }) => {
    const jointPath = findLayerPath(animation.layers, jointLayerId);
    if (!joints.has(jointId) || seen.has(jointId) || !jointPath)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Skin joint mapping must name each joint once and an existing layer",
        {
          details: { reason: "SKIN_LAYER_REFERENCE", layerId, jointId, jointLayerId },
        },
      );
    seen.add(jointId);
    // Shared ancestors act after skinning. Cancel them without inverting their transforms.
    let shared = 0;
    while (
      shared < meshPath.length - 1 &&
      shared < jointPath.length &&
      meshPath[shared]!.id === jointPath[shared]!.id
    )
      shared++;
    const meshTail = meshPath.slice(shared);
    const jointTail = jointPath.slice(shared);
    const crossing = [...meshTail.slice(0, -1), ...jointTail].find((layer) =>
      deformed.has(layer.id),
    );
    if (crossing)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Skin joint mapping crosses an independent deformation",
        {
          details: {
            reason: "SKIN_DEFORMATION_BOUNDARY",
            layerId,
            jointId,
            jointLayerId,
            boundaryLayerId: crossing.id,
          },
        },
      );
    return { jointId, jointLayerId, meshTail, jointTail, shared };
  });
  if (seen.size !== joints.size)
    throw new CodeboardError("INVALID_ARGUMENT", "Every skin joint needs a layer mapping", {
      details: { reason: "SKIN_LAYER_INCOMPLETE", layerId },
    });
  return (frame: number) => {
    if (!Number.isSafeInteger(frame))
      throw new CodeboardError("INVALID_ARGUMENT", "Skin frame must be a safe integer");
    // A scope is the cancelled prefix length on this skin's fixed mesh path.
    const localMatrices = new Map<string, AffineMatrix>();
    const scopeMatrices = new Map<number, Map<string, AffineMatrix>>();
    const meshInverses = new Map<number, AffineMatrix>();
    const pathMatrix = (path: readonly Layer[], scope: number): AffineMatrix => {
      let matrices = scopeMatrices.get(scope);
      if (!matrices) {
        matrices = new Map();
        scopeMatrices.set(scope, matrices);
      }
      let matrix: AffineMatrix = [1, 0, 0, 1, 0, 0];
      for (const layer of path) {
        const cached = matrices.get(layer.id);
        if (cached) {
          matrix = cached;
          continue;
        }
        let local = localMatrices.get(layer.id);
        if (!local) {
          local = matrixFromTransform(evaluateLayer(layer, frame).transform, layer.pivot);
          localMatrices.set(layer.id, local);
        }
        matrix = multiplyMatrices(matrix, local);
        matrices.set(layer.id, matrix);
      }
      return matrix;
    };
    return paths.map(({ jointId, jointLayerId, meshTail, jointTail, shared }) => {
      try {
        let meshInverse = meshInverses.get(shared);
        if (!meshInverse) {
          meshInverse = invertMatrix(pathMatrix(meshTail, shared));
          meshInverses.set(shared, meshInverse);
        }
        return {
          jointId,
          matrix: multiplyMatrices(meshInverse, pathMatrix(jointTail, shared)),
        };
      } catch (cause) {
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Skin joint pose requires finite invertible mesh transforms",
          {
            details: { reason: "SKIN_LAYER_TRANSFORM", layerId, jointId, jointLayerId, frame },
            cause,
          },
        );
      }
    });
  };
}

export function createLayerSkinEvaluator(
  layerId: string,
  input: LayerSkinInput,
  animation: ShotAnimation,
) {
  const { jointLayers: _jointLayers, ...skin } = input;
  const evaluate = createSkinMeshEvaluator(skin);
  const poses = prepareLayerSkinPoses(layerId, input, animation);
  return (frame: number) => evaluate(poses(frame));
}
