import type { Layer, Panel } from "../model/types.js";
import { evaluateLayer, type EvaluatedCamera } from "../animation/evaluate.js";
import { cameraPlane } from "../animation/camera-plane.js";

export type CompositionBounds = { x: number; y: number; width: number; height: number };

export function compositionBounds(
  panel: Panel,
  layers: Layer[],
  frame: number,
  camera?: EvaluatedCamera,
): CompositionBounds {
  let left = 0,
    top = 0,
    right = panel.width,
    bottom = panel.height;
  if (camera) {
    const c = Math.cos(camera.rotation),
      s = Math.sin(camera.rotation);
    for (const layer of layers) {
      const { zoom, panX, panY } = cameraPlane(
        camera,
        evaluateLayer(layer, frame).depth,
        panel.width,
        panel.height,
      );
      for (const [x, y] of [
        [0, 0],
        [panel.width, 0],
        [0, panel.height],
        [panel.width, panel.height],
      ]) {
        const u = (x! - panel.width / 2) / zoom,
          v = (y! - panel.height / 2) / zoom;
        const wx = c * u - s * v + panel.width / 2 + panX;
        const wy = s * u + c * v + panel.height / 2 + panY;
        if (!Number.isFinite(wx) || !Number.isFinite(wy))
          throw new Error("Camera plane composition bounds exceed the supported numerical range");
        left = Math.min(left, Math.floor(wx));
        top = Math.min(top, Math.floor(wy));
        right = Math.max(right, Math.ceil(wx));
        bottom = Math.max(bottom, Math.ceil(wy));
      }
    }
  }
  const width = right - left,
    height = bottom - top;
  if (!Number.isFinite(width) || !Number.isFinite(height))
    throw new Error("Camera plane composition bounds exceed the supported numerical range");
  return { x: left, y: top, width, height };
}
