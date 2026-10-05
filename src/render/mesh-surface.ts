import { Canvas, type CanvasRenderingContext2D } from "skia-canvas";
import { prepareIndexedMeshWarp, type IndexedMeshWarp } from "../animation/mesh-warp.js";
import { CodeboardError } from "../model/errors.js";
import { validateDimensions } from "../model/validation/pixels.js";
import { renderIndexedMeshWarp } from "./triangle-warp.js";
import type { CompositionBounds } from "./composition-bounds.js";
import type { RenderMatrix } from "./placement.js";

/** Rasterize in bind-local space, then flatten the warped output before releasing its texture. */
export function renderMeshSurface(
  mesh: IndexedMeshWarp,
  resolution: number,
  paint: (
    context: CanvasRenderingContext2D,
    bounds: CompositionBounds,
    localToTexture: RenderMatrix,
  ) => void,
) {
  prepareIndexedMeshWarp(mesh);
  if (!mesh.triangles.length)
    throw new CodeboardError("INVALID_ARGUMENT", "A mesh surface requires at least one triangle", {
      details: { reason: "MESH_SURFACE_EMPTY" },
    });
  if (!Number.isFinite(resolution) || resolution <= 0)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Mesh surface resolution must be finite and positive",
      {
        details: { reason: "MESH_SURFACE_RESOLUTION", resolution },
      },
    );
  const boundsOf = (vertices: IndexedMeshWarp["source"]) => {
    let left = Infinity,
      top = Infinity,
      right = -Infinity,
      bottom = -Infinity;
    for (const indices of mesh.triangles)
      for (const index of indices) {
        const point = vertices[index]!;
        left = Math.min(left, point.x);
        top = Math.min(top, point.y);
        right = Math.max(right, point.x);
        bottom = Math.max(bottom, point.y);
      }
    const x = Math.floor(left),
      y = Math.floor(top);
    const width = Math.ceil(right) - x,
      height = Math.ceil(bottom) - y;
    const pixelWidth = Math.ceil(width * resolution),
      pixelHeight = Math.ceil(height * resolution);
    validateDimensions(pixelWidth, pixelHeight);
    if (![x, y, width, height, -x * resolution, -y * resolution].every(Number.isFinite))
      throw new CodeboardError("INVALID_ARGUMENT", "Mesh surface bounds exceed numerical limits", {
        details: { reason: "MESH_SURFACE_BOUNDS" },
      });
    return { x, y, width, height, pixelWidth, pixelHeight };
  };
  const bind = boundsOf(mesh.source),
    deformed = boundsOf(mesh.destination);
  const pixels: IndexedMeshWarp = {
    source: mesh.source.map(({ x, y }) => ({
      x: (x - bind.x) * resolution,
      y: (y - bind.y) * resolution,
    })),
    destination: mesh.destination.map(({ x, y }) => ({
      x: (x - deformed.x) * resolution,
      y: (y - deformed.y) * resolution,
    })),
    triangles: mesh.triangles,
  };
  prepareIndexedMeshWarp(pixels);
  const localToTexture = {
    a: resolution,
    b: 0,
    c: 0,
    d: resolution,
    e: -bind.x * resolution,
    f: -bind.y * resolution,
  };
  const texture = new Canvas(bind.pixelWidth, bind.pixelHeight);
  const context = texture.getContext("2d");
  let output: Canvas | undefined;
  try {
    context.setTransform(localToTexture);
    paint(context, bind, { ...localToTexture });
    output = renderIndexedMeshWarp(texture, pixels, {
      x: 0,
      y: 0,
      width: deformed.pixelWidth,
      height: deformed.pixelHeight,
    });
    const target = output.getContext("2d");
    const flattened = target.getImageData(0, 0, output.width, output.height);
    target.reset();
    target.putImageData(flattened, 0, 0);
    return {
      canvas: output,
      x: deformed.x,
      y: deformed.y,
      width: output.width / resolution,
      height: output.height / resolution,
    };
  } catch (error) {
    output?.getContext("2d").reset();
    throw error;
  } finally {
    context.reset();
  }
}
