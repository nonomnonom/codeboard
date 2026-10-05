import type {
  EnvelopeMeshInput,
  EnvelopeMeshPose,
  MeshAnimation,
} from "../model/types/deformation.js";
import { envelopeMeshSchema } from "../model/schema/deformation.js";
import { CodeboardError } from "../model/errors.js";
import { cubic } from "../drawing/curve-sampling.js";
import { createMeshAnimationEvaluator } from "./mesh-animation.js";

/** Tessellate a four-boundary Coons patch into an editable vertex animation. */
export function bakeEnvelopeMesh(input: EnvelopeMeshInput): MeshAnimation {
  const parsed = envelopeMeshSchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid envelope mesh input", {
      details: { reason: "ENVELOPE_MESH_INPUT", issues: parsed.error.issues },
    });
  const { rest, columns, rows, keyframes } = parsed.data;
  const count = (columns + 1) * (rows + 1);
  if (2 * columns * rows > 4096 || count * (keyframes.length + 1) > 262144)
    throw new CodeboardError("RESOURCE_LIMIT", "Envelope exceeds the mesh geometry budget", {
      details: { reason: "ENVELOPE_MESH_LIMIT", columns, rows, frames: keyframes.length },
    });
  const vertices = (pose: EnvelopeMeshPose, frame: number | null) => {
    const corners = [
      [pose.top[0], pose.left[0]],
      [pose.top[3], pose.right[0]],
      [pose.bottom[0], pose.left[3]],
      [pose.bottom[3], pose.right[3]],
    ] as const;
    for (const [index, [a, b]] of corners.entries())
      if (a.x !== b.x || a.y !== b.y)
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Envelope boundary corners must meet exactly",
          {
            details: { reason: "ENVELOPE_CORNERS", corner: index, frame },
          },
        );
    const top = cubic(...pose.top, columns + 1),
      bottom = cubic(...pose.bottom, columns + 1);
    const left = cubic(...pose.left, rows + 1),
      right = cubic(...pose.right, rows + 1);
    const result: { x: number; y: number }[] = [];
    for (let row = 0; row <= rows; row++) {
      const v = row / rows;
      for (let column = 0; column <= columns; column++) {
        const u = column / columns;
        // Keep sampled boundary coordinates exact; interior subtracts duplicated corner blending.
        if (row === 0) result.push({ x: top[column]!.x, y: top[column]!.y });
        else if (row === rows) result.push({ x: bottom[column]!.x, y: bottom[column]!.y });
        else if (column === 0) result.push({ x: left[row]!.x, y: left[row]!.y });
        else if (column === columns) result.push({ x: right[row]!.x, y: right[row]!.y });
        else {
          const blend = (axis: "x" | "y") =>
            (1 - v) * top[column]![axis] +
            v * bottom[column]![axis] +
            (1 - u) * left[row]![axis] +
            u * right[row]![axis] -
            ((1 - u) * (1 - v) * pose.top[0][axis] +
              u * (1 - v) * pose.top[3][axis] +
              (1 - u) * v * pose.bottom[0][axis] +
              u * v * pose.bottom[3][axis]);
          result.push({ x: blend("x"), y: blend("y") });
        }
      }
    }
    return result;
  };
  const triangles: [number, number, number][] = [];
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column,
        b = a + 1,
        c = a + columns + 1,
        d = c + 1;
      triangles.push([a, b, d], [a, d, c]);
    }
  const result: MeshAnimation = {
    source: vertices(rest, null),
    triangles,
    keyframes: keyframes.map((key) => ({
      frame: key.frame,
      easing: key.easing,
      vertices: vertices(key.pose, key.frame),
    })),
  };
  createMeshAnimationEvaluator(result);
  return result;
}
