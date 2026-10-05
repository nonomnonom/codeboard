import type { MeshAnimation, CurveMeshInput, CurveMeshPose } from "../model/types/deformation.js";
export type { CurveMeshInput, CurveMeshPose } from "../model/types/deformation.js";
import { curveMeshSchema } from "../model/schema/deformation.js";
import { CodeboardError } from "../model/errors.js";
import { cubic } from "../drawing/curve-sampling.js";
import { createMeshAnimationEvaluator } from "./mesh-animation.js";
import { prepareIndexedMeshWarp, type IndexedMeshWarp } from "./mesh-warp.js";
import { ease } from "./evaluate.js";

function prepareCurveMesh(input: CurveMeshInput) {
  const parsed = curveMeshSchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid curve mesh input", {
      details: { reason: "CURVE_MESH_INPUT", issues: parsed.error.issues },
    });
  const { rest, segments, keyframes } = parsed.data;
  const vertexCount = 2 * (segments + 1);
  if (vertexCount * (keyframes.length + 1) > 262144)
    throw new CodeboardError("RESOURCE_LIMIT", "Curve mesh exceeds the pose storage budget", {
      details: { reason: "MESH_POSE_LIMIT", vertices: vertexCount, frames: keyframes.length },
    });
  const vertices = ({ curve, width }: CurveMeshPose, frame: number | null) => {
    const centers = cubic(...curve, segments + 1);
    const [a, b, c, d] = curve;
    return centers.flatMap((center, index) => {
      const t = index / segments,
        u = 1 - t;
      const dx = 3 * (u * u * (b.x - a.x) + 2 * u * t * (c.x - b.x) + t * t * (d.x - c.x));
      const dy = 3 * (u * u * (b.y - a.y) + 2 * u * t * (c.y - b.y) + t * t * (d.y - c.y));
      const length = Math.hypot(dx, dy);
      if (!Number.isFinite(length) || length === 0)
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Curve ribbon requires a finite nonzero sampled tangent",
          {
            details: { reason: "CURVE_MESH_TANGENT", frame, sample: index },
          },
        );
      const nx = ((-dy / length) * width) / 2,
        ny = ((dx / length) * width) / 2;
      return [
        { x: center.x - nx, y: center.y - ny },
        { x: center.x + nx, y: center.y + ny },
      ];
    });
  };
  const triangles: [number, number, number][] = [];
  for (let index = 0; index < segments; index++) {
    const a = index * 2;
    triangles.push([a, a + 2, a + 3], [a, a + 3, a + 1]);
  }
  const mesh: MeshAnimation = {
    source: vertices(rest, null),
    triangles,
    keyframes: keyframes.map((key) => ({
      frame: key.frame,
      easing: key.easing,
      vertices: vertices(key, key.frame),
    })),
  };
  createMeshAnimationEvaluator(mesh);
  return { mesh, rest, keyframes, vertices };
}

/** Bake sampled curve ribbons into editable mesh keys; interpolation remains vertex-based. */
export function bakeCurveMesh(input: CurveMeshInput): MeshAnimation {
  return prepareCurveMesh(input).mesh;
}

/** Evaluate controls first, then sample normals; no previous frame contributes to the pose. */
export function createCurveMeshEvaluator(input: CurveMeshInput) {
  const { mesh, rest, keyframes, vertices } = prepareCurveMesh(input);
  const { source, triangles } = mesh;
  return (frame: number): IndexedMeshWarp => {
    if (!Number.isSafeInteger(frame))
      throw new CodeboardError("INVALID_ARGUMENT", "Curve frame must be a safe integer", {
        details: { reason: "CURVE_MESH_FRAME", frame },
      });
    let low = 0,
      high = keyframes.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (keyframes[middle]!.frame <= frame) low = middle + 1;
      else high = middle;
    }
    const before = keyframes[Math.max(0, low - 1)],
      after = keyframes[Math.min(low, keyframes.length - 1)];
    let pose: CurveMeshPose = rest;
    if (before && after) {
      if (before.frame === after.frame) pose = before;
      else {
        const t = ease((frame - before.frame) / (after.frame - before.frame), before.easing);
        const mix = (a: number, b: number) => (t === 0 ? a : t === 1 ? b : (1 - t) * a + t * b);
        const point = (index: number) => ({
          x: mix(before.curve[index]!.x, after.curve[index]!.x),
          y: mix(before.curve[index]!.y, after.curve[index]!.y),
        });
        pose = {
          width: mix(before.width, after.width),
          curve: [point(0), point(1), point(2), point(3)],
        };
      }
    }
    try {
      const result: IndexedMeshWarp = {
        source: source.map((point) => ({ ...point })),
        triangles: triangles.map(([a, b, c]) => [a, b, c]),
        destination: vertices(pose, frame),
      };
      prepareIndexedMeshWarp(result);
      return result;
    } catch (cause) {
      if (cause instanceof CodeboardError)
        throw new CodeboardError(cause.code, cause.message, {
          details: { ...cause.details, frame },
          cause,
        });
      throw new CodeboardError("INVALID_ARGUMENT", "Curve pose exceeds numerical limits", {
        details: { reason: "CURVE_MESH_POSE", frame },
        cause,
      });
    }
  };
}
