import type { MeshAnimation } from "../model/types/deformation.js";
export type { MeshAnimation } from "../model/types/deformation.js";
import { meshAnimationSchema } from "../model/schema/deformation.js";
import { CodeboardError } from "../model/errors.js";
import { ease } from "./evaluate.js";
import { prepareIndexedMeshWarp, type IndexedMeshWarp } from "./mesh-warp.js";

/** Validate once and keep a private detached track for deterministic random-access evaluation. */
export function createMeshAnimationEvaluator(value: MeshAnimation) {
  const parsed = meshAnimationSchema.safeParse(value);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid mesh animation", {
      details: { reason: "MESH_ANIMATION_SCHEMA", issues: parsed.error.issues },
      cause: parsed.error,
    });
  const input = parsed.data;
  const vertexCount = input.source.length;
  if (input.keyframes.length > 4096 || vertexCount * (input.keyframes.length + 1) > 262144)
    throw new CodeboardError("RESOURCE_LIMIT", "Mesh animation exceeds the pose storage budget", {
      details: { reason: "MESH_POSE_LIMIT", frames: input.keyframes.length, vertices: vertexCount },
    });
  prepareIndexedMeshWarp({ ...input, destination: input.source });
  const source = input.source.map(({ x, y }) => ({ x, y }));
  const triangles = input.triangles.map(([a, b, c]): [number, number, number] => [a, b, c]);
  let previous = -Infinity;
  const keyframes = input.keyframes.map((key, keyIndex) => {
    if (!Number.isSafeInteger(key.frame) || key.frame <= previous)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Mesh keyframes must be safe, ordered and unique",
        {
          details: { reason: "MESH_KEYFRAME_ORDER", keyIndex, frame: key.frame },
        },
      );
    previous = key.frame;
    try {
      prepareIndexedMeshWarp({ source, triangles, destination: key.vertices });
    } catch (cause) {
      if (cause instanceof CodeboardError)
        throw new CodeboardError(cause.code, cause.message, {
          details: { ...cause.details, keyIndex, frame: key.frame },
          cause,
        });
      throw cause;
    }
    return {
      frame: key.frame,
      vertices: key.vertices.map(({ x, y }) => ({ x, y })),
      easing: key.easing,
    };
  });
  return (frame: number): IndexedMeshWarp => {
    if (!Number.isSafeInteger(frame))
      throw new CodeboardError("INVALID_ARGUMENT", "Mesh evaluation frame must be a safe integer", {
        details: { reason: "MESH_EVALUATION_FRAME", frame },
      });
    let low = 0,
      high = keyframes.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (keyframes[middle]!.frame <= frame) low = middle + 1;
      else high = middle;
    }
    const before = keyframes[Math.max(0, low - 1)];
    const after = keyframes[Math.min(low, keyframes.length - 1)];
    let destination = source;
    if (before && after) {
      if (before.frame === after.frame) destination = before.vertices;
      else {
        const t = ease((frame - before.frame) / (after.frame - before.frame), before.easing);
        destination = before.vertices.map((a, index) => {
          const b = after.vertices[index]!;
          return {
            x: t === 0 ? a.x : t === 1 ? b.x : (1 - t) * a.x + t * b.x,
            y: t === 0 ? a.y : t === 1 ? b.y : (1 - t) * a.y + t * b.y,
          };
        });
      }
    }
    const result: IndexedMeshWarp = {
      source: source.map(({ x, y }) => ({ x, y })),
      triangles: triangles.map(([a, b, c]) => [a, b, c]),
      destination: destination.map(({ x, y }) => ({ x, y })),
    };
    // Valid endpoint poses can still collapse or flip a face between keys.
    try {
      prepareIndexedMeshWarp(result);
    } catch (cause) {
      if (cause instanceof CodeboardError)
        throw new CodeboardError(cause.code, cause.message, {
          details: { ...cause.details, frame },
          cause,
        });
      throw cause;
    }
    return result;
  };
}
