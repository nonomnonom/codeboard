import type { AffineMatrix } from "../model/types/primitives.js";
import { CodeboardError } from "../model/errors.js";
import { invertMatrix, multiplyMatrices, transformPoint } from "../drawing/math.js";

export type Triangle = readonly [
  { readonly x: number; readonly y: number },
  { readonly x: number; readonly y: number },
  { readonly x: number; readonly y: number },
];

/** Prepare a detached, invertible mapping; each triangle retains its winding. */
export function prepareTriangleWarp(source: Triangle, destination: Triangle) {
  const basis = (points: Triangle, space: "source" | "destination") => {
    if (
      points.length !== 3 ||
      points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))
    )
      throw new CodeboardError("INVALID_ARGUMENT", "Warp triangle requires three finite points", {
        details: { reason: "WARP_TRIANGLE_POINTS", space },
      });
    const [origin, u, v] = points;
    const matrix: AffineMatrix = [
      u.x - origin.x,
      u.y - origin.y,
      v.x - origin.x,
      v.y - origin.y,
      origin.x,
      origin.y,
    ];
    const scale = Math.max(...matrix.slice(0, 4).map(Math.abs));
    const determinant =
      (matrix[0] / scale) * (matrix[3] / scale) - (matrix[1] / scale) * (matrix[2] / scale);
    if (
      !matrix.every(Number.isFinite) ||
      !Number.isFinite(determinant) ||
      Math.abs(determinant) <= Number.EPSILON * 8
    )
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Warp triangle is degenerate or ill-conditioned",
        {
          details: { reason: "WARP_TRIANGLE_DEGENERATE", space },
        },
      );
    return { matrix, determinant };
  };
  const from = basis(source, "source"),
    to = basis(destination, "destination");
  if (Math.sign(from.determinant) !== Math.sign(to.determinant))
    throw new CodeboardError("INVALID_ARGUMENT", "Warp triangle may not reverse its winding", {
      details: { reason: "WARP_TRIANGLE_FOLDOVER" },
    });
  try {
    const copy = ([a, b, c]: Triangle): Triangle => [
      { x: a.x, y: a.y },
      { x: b.x, y: b.y },
      { x: c.x, y: c.y },
    ];
    const sourceToUnit = invertMatrix(from.matrix);
    const destinationToUnit = invertMatrix(to.matrix);
    return {
      source: copy(source),
      destination: copy(destination),
      sourceToUnit,
      destinationToUnit,
      forward: multiplyMatrices(to.matrix, sourceToUnit),
      inverse: multiplyMatrices(from.matrix, destinationToUnit),
    };
  } catch (cause) {
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Warp mapping exceeds the supported numerical range",
      {
        details: { reason: "WARP_MATRIX_RANGE" },
        cause,
      },
    );
  }
}

export function queryTriangleWarp(
  triangle: ReturnType<typeof prepareTriangleWarp>,
  point: { x: number; y: number },
  direction: "forward" | "inverse",
) {
  if (direction !== "forward" && direction !== "inverse")
    throw new CodeboardError("INVALID_ARGUMENT", "Unknown warp query direction", {
      details: { reason: "WARP_QUERY_DIRECTION", direction },
    });
  try {
    const unit = transformPoint(
      direction === "forward" ? triangle.sourceToUnit : triangle.destinationToUnit,
      point,
    );
    const weights: [number, number, number] = [1 - unit.x - unit.y, unit.x, unit.y];
    const tolerance = Number.EPSILON * 64;
    if (weights.some((weight) => weight < -tolerance || weight > 1 + tolerance)) return null;
    return {
      point: transformPoint(direction === "forward" ? triangle.forward : triangle.inverse, point),
      weights,
    };
  } catch (cause) {
    throw new CodeboardError("INVALID_ARGUMENT", "Warp point query exceeds the numerical range", {
      details: { reason: "WARP_QUERY_RANGE", direction, point },
      cause,
    });
  }
}
