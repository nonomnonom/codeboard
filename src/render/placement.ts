import type { CanvasRenderingContext2D } from "skia-canvas";
import type { Transform, Pivot, Panel } from "../model/types.js";
import type { EvaluatedCamera } from "../animation/evaluate.js";
import type { cameraPlane } from "../animation/camera-plane.js";
import { invertMatrix, multiplyMatrices } from "../drawing/math.js";
import { CodeboardError } from "../model/errors.js";

export type RenderMatrix = { a: number; b: number; c: number; d: number; e: number; f: number };

export function rebaseSurface(
  localToSurface: RenderMatrix,
  panelToSurface: RenderMatrix,
  localToTexture: RenderMatrix,
): RenderMatrix {
  const array = ({ a, b, c, d, e, f }: RenderMatrix) => [a, b, c, d, e, f];
  try {
    const [a, b, c, d, e, f] = multiplyMatrices(
      array(localToTexture),
      multiplyMatrices(invertMatrix(array(localToSurface)), array(panelToSurface)),
    );
    return { a, b, c, d, e, f };
  } catch (cause) {
    throw new CodeboardError("INVALID_ARGUMENT", "Cannot map panel space into the mesh texture", {
      details: { reason: "MESH_SURFACE_TRANSFORM" },
      cause,
    });
  }
}

/** Base panel-to-surface mapping, shared by artwork and masks in local offscreen composition. */
export function placeSurface(
  context: CanvasRenderingContext2D,
  resolution: number,
  bounds: { x: number; y: number },
  panelToSurface?: RenderMatrix,
): void {
  if (panelToSurface) {
    const { a, b, c, d, e, f } = panelToSurface;
    context.setTransform(a, b, c, d, e, f);
  } else {
    context.resetTransform();
    context.scale(resolution, resolution);
    context.translate(-bounds.x, -bounds.y);
  }
}

export function placeLayer(ctx: CanvasRenderingContext2D, transform: Transform, pivot?: Pivot) {
  ctx.translate(transform.x, transform.y);
  if (pivot) ctx.translate(pivot.x, pivot.y);
  ctx.rotate(transform.rotation);
  ctx.scale(transform.scaleX, transform.scaleY);
  if (pivot) ctx.translate(-pivot.x, -pivot.y);
}

export function placeCameraPlane(
  target: CanvasRenderingContext2D,
  panel: Pick<Panel, "width" | "height">,
  camera: EvaluatedCamera,
  placement: ReturnType<typeof cameraPlane>,
): void {
  target.translate(panel.width / 2, panel.height / 2);
  target.rotate(-camera.rotation);
  target.scale(placement.zoom, placement.zoom);
  target.translate(-panel.width / 2 - placement.panX, -panel.height / 2 - placement.panY);
}
