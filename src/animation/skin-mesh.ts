import type { SkinMeshInput, SkinJointPose } from "../model/types/deformation.js";
import { skinMeshSchema, skinJointPosesSchema } from "../model/schema/deformation.js";
import { CodeboardError } from "../model/errors.js";
import { invertMatrix, multiplyMatrices, transformPoint } from "../drawing/math.js";
import { prepareIndexedMeshWarp, type IndexedMeshWarp } from "./mesh-warp.js";

/** Bind explicit weights once; joint poses and output are in the mesh's local coordinate space. */
export function createSkinMeshEvaluator(input: SkinMeshInput) {
  const parsed = skinMeshSchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid skin binding", {
      details: { reason: "SKIN_INPUT", issues: parsed.error.issues },
    });
  const { source, triangles, joints, weights } = parsed.data;
  prepareIndexedMeshWarp({ source, triangles, destination: source });
  if (weights.length !== source.length)
    throw new CodeboardError("INVALID_ARGUMENT", "Skin requires weights for every vertex", {
      details: { reason: "SKIN_WEIGHT_COUNT" },
    });
  const inverses = new Map<string, ReturnType<typeof invertMatrix>>();
  for (const joint of joints) {
    if (inverses.has(joint.id))
      throw new CodeboardError("INVALID_ARGUMENT", "Duplicate skin joint", {
        details: { reason: "SKIN_JOINT_DUPLICATE", jointId: joint.id },
      });
    try {
      inverses.set(joint.id, invertMatrix(joint.bind));
    } catch (cause) {
      throw new CodeboardError("INVALID_ARGUMENT", "Skin bind matrix is not safely invertible", {
        details: { reason: "SKIN_BIND_MATRIX", jointId: joint.id },
        cause,
      });
    }
  }
  for (const [vertexIndex, influences] of weights.entries()) {
    const ids = new Set<string>();
    let total = 0;
    for (const influence of influences) {
      if (!inverses.has(influence.jointId) || ids.has(influence.jointId))
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Skin weights require distinct existing joints",
          {
            details: { reason: "SKIN_WEIGHT_JOINT", vertexIndex, jointId: influence.jointId },
          },
        );
      ids.add(influence.jointId);
      total += influence.weight;
    }
    if (Math.abs(total - 1) > Number.EPSILON * 64)
      throw new CodeboardError("INVALID_ARGUMENT", "Skin vertex weights must sum to one", {
        details: { reason: "SKIN_WEIGHT_SUM", vertexIndex, total },
      });
    for (const influence of influences) influence.weight /= total;
  }
  return (poses: readonly SkinJointPose[]): IndexedMeshWarp => {
    const parsedPoses = skinJointPosesSchema.safeParse(poses);
    if (!parsedPoses.success)
      throw new CodeboardError("INVALID_ARGUMENT", "Invalid skin joint poses", {
        details: { reason: "SKIN_POSES", issues: parsedPoses.error.issues },
      });
    const matrices = new Map<string, ReturnType<typeof multiplyMatrices>>();
    for (const pose of parsedPoses.data) {
      const inverse = inverses.get(pose.jointId);
      if (!inverse || matrices.has(pose.jointId))
        throw new CodeboardError("INVALID_ARGUMENT", "Skin pose requires distinct bound joints", {
          details: { reason: "SKIN_POSE_JOINT", jointId: pose.jointId },
        });
      try {
        matrices.set(pose.jointId, multiplyMatrices(pose.matrix, inverse));
      } catch (cause) {
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Skin joint transform exceeds numerical limits",
          {
            details: { reason: "SKIN_POSE_MATRIX", jointId: pose.jointId },
            cause,
          },
        );
      }
    }
    if (matrices.size !== inverses.size)
      throw new CodeboardError("INVALID_ARGUMENT", "Skin pose must specify every bound joint", {
        details: { reason: "SKIN_POSE_INCOMPLETE" },
      });
    const destination = source.map((point, vertexIndex) => {
      try {
        let x = 0,
          y = 0;
        for (const influence of weights[vertexIndex]!) {
          const mapped = transformPoint(matrices.get(influence.jointId)!, point);
          x += mapped.x * influence.weight;
          y += mapped.y * influence.weight;
        }
        return { x, y };
      } catch (cause) {
        throw new CodeboardError("INVALID_ARGUMENT", "Skinned vertex exceeds numerical limits", {
          details: { reason: "SKIN_VERTEX_RANGE", vertexIndex },
          cause,
        });
      }
    });
    const result: IndexedMeshWarp = {
      source: source.map((point) => ({ ...point })),
      triangles: triangles.map(([a, b, c]) => [a, b, c]),
      destination,
    };
    prepareIndexedMeshWarp(result);
    return result;
  };
}
