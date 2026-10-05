import type { Canvas } from "skia-canvas";
import { rasterizeMesh } from "./mesh-raster.js";
import { prepareTriangleWarp, type Triangle } from "../animation/triangle-warp.js";
import { CodeboardError } from "../model/errors.js";
import { validateDimensions } from "../model/validation/pixels.js";
import type { CompositionBounds } from "./composition-bounds.js";
import { prepareIndexedMeshWarp, type IndexedMeshWarp } from "../animation/mesh-warp.js";
import { createMeshAnimationEvaluator, type MeshAnimation } from "../animation/mesh-animation.js";

export function createMeshWarpRenderer(source: Canvas, animation: MeshAnimation) {
  validateDimensions(source.width, source.height);
  const evaluate = createMeshAnimationEvaluator(animation);
  return (frame: number, bounds: CompositionBounds): Canvas =>
    renderIndexedMeshWarp(source, evaluate(frame), bounds);
}

export function renderIndexedMeshWarp(
  source: Canvas,
  mesh: IndexedMeshWarp,
  bounds: CompositionBounds,
): Canvas {
  return renderTriangleWarp(source, prepareIndexedMeshWarp(mesh), bounds);
}

/** Source triangles use texture pixels; destination triangles use the supplied bounds' space. */
export function renderTriangleWarp(
  source: Canvas,
  triangles: readonly { source: Triangle; destination: Triangle }[],
  bounds: CompositionBounds,
): Canvas {
  validateDimensions(source.width, source.height);
  validateDimensions(bounds.width, bounds.height);
  if (
    ![bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height].every(Number.isFinite)
  )
    throw new CodeboardError("INVALID_ARGUMENT", "Warp bounds must be finite", {
      details: { reason: "WARP_BOUNDS" },
    });
  if (triangles.length > 4096)
    throw new CodeboardError("RESOURCE_LIMIT", "Warp exceeds the 4096 triangle budget", {
      details: { reason: "WARP_TRIANGLE_LIMIT", count: triangles.length, limit: 4096 },
    });
  const prepared = triangles.map((triangle, triangleIndex) => {
    try {
      const mapping = prepareTriangleWarp(triangle.source, triangle.destination);
      if (
        mapping.source.some(({ x, y }) => x < 0 || y < 0 || x > source.width || y > source.height)
      )
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Warp source triangle is outside its texture",
          {
            details: { reason: "WARP_SOURCE_BOUNDS" },
          },
        );
      return mapping;
    } catch (cause) {
      if (cause instanceof CodeboardError)
        throw new CodeboardError(cause.code, cause.message, {
          details: { ...cause.details, triangleIndex },
          cause,
        });
      throw cause;
    }
  });
  return rasterizeMesh(source, prepared, bounds);
}
