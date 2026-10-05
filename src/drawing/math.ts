import type { AffineMatrix, Point, Transform, Pivot } from "../model/types.js";

function finite(values: readonly number[]) {
  if (values.some((value) => typeof value !== "number" || !Number.isFinite(value)))
    throw new Error("Geometry values must be finite numbers");
}

/** Preserve ordinary interpolation while avoiding overflow in the endpoint difference. */
export function interpolateNumber(a: number, b: number, t: number): number {
  finite([a, b, t]);
  if (t === 0) return a;
  if (t === 1) return b;
  const difference = b - a;
  const result = Number.isFinite(difference) ? a + difference * t : (1 - t) * a + t * b;
  finite([result]);
  return result;
}
function matrix(values: readonly number[]): AffineMatrix {
  if (values.length !== 6) throw new Error("An affine matrix requires six numbers");
  finite(values);
  return [...values] as AffineMatrix;
}
/** Composition A × B applies B first, then A. */
export function multiplyMatrices(left: readonly number[], right: readonly number[]): AffineMatrix {
  const [a, b, c, d, e, f] = matrix(left),
    [g, h, i, j, k, l] = matrix(right);
  return matrix([
    a * g + c * h,
    b * g + d * h,
    a * i + c * j,
    b * i + d * j,
    a * k + c * l + e,
    b * k + d * l + f,
  ]);
}
export function matrixFromTransform(
  value: Partial<Transform>,
  pivot: Pivot = { x: 0, y: 0 },
): AffineMatrix {
  const { x = 0, y = 0, rotation = 0, scaleX = 1, scaleY = 1 } = value;
  finite([x, y, rotation, scaleX, scaleY]);
  finite([pivot.x, pivot.y]);
  const c = Math.cos(rotation),
    s = Math.sin(rotation),
    a = c * scaleX,
    b = s * scaleX,
    d = c * scaleY,
    h = -s * scaleY;
  return matrix([
    a,
    b,
    h,
    d,
    x + (1 - a) * pivot.x - h * pivot.y,
    y - b * pivot.x + (1 - d) * pivot.y,
  ]);
}
export function invertMatrix(value: readonly number[]): AffineMatrix {
  const [a, b, c, d, e, f] = matrix(value),
    scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d));
  if (scale === 0) throw new Error("Matrix is singular or too ill-conditioned to invert safely");
  const aa = a / scale,
    bb = b / scale,
    cc = c / scale,
    dd = d / scale,
    det = aa * dd - bb * cc;
  if (Math.abs(det) <= Number.EPSILON * 8)
    throw new Error("Matrix is singular or too ill-conditioned to invert safely");
  const ia = dd / det / scale,
    ib = -bb / det / scale,
    ic = -cc / det / scale,
    id = aa / det / scale;
  return matrix([ia, ib, ic, id, -ia * e - ic * f, -ib * e - id * f]);
}
export function transformPoint(
  value: readonly number[],
  point: Pick<Point, "x" | "y">,
): { x: number; y: number } {
  const [a, b, c, d, e, f] = matrix(value);
  finite([point.x, point.y]);
  const x = a * point.x + c * point.y + e,
    y = b * point.x + d * point.y + f;
  finite([x, y]);
  return { x, y };
}
