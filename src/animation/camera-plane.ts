import type { EvaluatedCamera } from "./evaluate.js";
import { matrixFromTransform, multiplyMatrices } from "../drawing/math.js";

export function cameraPlane(camera: EvaluatedCamera, depth: number, width: number, height: number) {
  if (
    ![camera.x, camera.y, camera.zoom, camera.rotation, depth, width, height].every(
      Number.isFinite,
    ) ||
    camera.zoom <= 0 ||
    depth <= 0
  )
    throw new Error("Camera plane requires finite camera values and positive zoom/depth");
  const zoom = camera.zoom ** (1 / depth),
    panX = camera.x / depth,
    panY = camera.y / depth;
  if (
    !Number.isFinite(zoom) ||
    zoom <= 0 ||
    !Number.isFinite(1 / zoom) ||
    !Number.isFinite(panX) ||
    !Number.isFinite(panY)
  )
    throw new Error(
      "Camera/depth combination exceeds the supported numerical range; increase depth or reduce camera zoom/pan",
    );
  try {
    const matrix = multiplyMatrices(
      matrixFromTransform({
        x: width / 2,
        y: height / 2,
        rotation: -camera.rotation,
        scaleX: zoom,
        scaleY: zoom,
      }),
      matrixFromTransform({ x: -width / 2 - panX, y: -height / 2 - panY }),
    );
    return { zoom, panX, panY, matrix };
  } catch {
    throw new Error(
      "Camera plane transform exceeds the supported numerical range; increase depth or reduce camera zoom/pan",
    );
  }
}
