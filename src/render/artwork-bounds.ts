import { CodeboardError } from "../model/errors.js";
import { Canvas } from "skia-canvas";
import type { DrawingLayer, AffineMatrix } from "../model/types.js";
import { brushPadding } from "./brush-dynamics.js";

/** Conservative local artwork bounds, including element transforms and paint padding. */
export function artworkBounds(layer: DrawingLayer): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const include = (
    left: number,
    top: number,
    right: number,
    bottom: number,
    matrix?: AffineMatrix,
    padding = 0,
  ) => {
    const [a, b, c, d, e, f] = matrix ?? [1, 0, 0, 1, 0, 0];
    for (const [u, v] of [
      [left, top],
      [right, top],
      [left, bottom],
      [right, bottom],
    ]) {
      const x = a * u! + c * v! + e,
        y = b * u! + d * v! + f;
      if (![x - padding, y - padding, x + padding, y + padding].every(Number.isFinite))
        throw new CodeboardError(
          "RESOURCE_LIMIT",
          "Artwork bounds exceed the supported numerical range",
          {
            details: { reason: "ARTWORK_BOUNDS_RANGE", layerId: layer.id },
          },
        );
      minX = Math.min(minX, x - padding);
      minY = Math.min(minY, y - padding);
      maxX = Math.max(maxX, x + padding);
      maxY = Math.max(maxY, y + padding);
    }
  };
  for (const e of layer.elements) {
    if (e.kind === "raster-surface") {
      include(0, 0, e.width, e.height, e.matrix, 1);
      continue;
    }
    if (e.kind === "text") {
      const context = new Canvas(1, 1).getContext("2d");
      context.font = e.font;
      context.textAlign = e.align;
      const m = context.measureText(e.text);
      include(
        e.x - m.actualBoundingBoxLeft - 2,
        e.y - m.actualBoundingBoxAscent - 2,
        e.x + m.actualBoundingBoxRight + 2,
        e.y + m.actualBoundingBoxDescent + 2,
        e.matrix,
      );
      continue;
    }
    const padding =
      e.kind === "raster-stroke"
        ? brushPadding(e.brush)
        : e.kind === "vector-stroke"
          ? e.width
          : e.strokeWidth;
    const points =
      e.kind === "vector-path"
        ? e.commands.flatMap((c) =>
            c.op === "Z"
              ? []
              : [
                  { x: c.x, y: c.y },
                  ...("x1" in c ? [{ x: c.x1, y: c.y1 }] : []),
                  ...("x2" in c ? [{ x: c.x2, y: c.y2 }] : []),
                ],
          )
        : e.points;
    for (const p of points)
      include(p.x - padding, p.y - padding, p.x + padding, p.y + padding, e.matrix);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 1;
    maxY = 1;
  }
  const x = Math.floor(minX),
    y = Math.floor(minY),
    width = Math.max(1, Math.ceil(maxX) - x),
    height = Math.max(1, Math.ceil(maxY) - y);

  return { x, y, width, height };
}
