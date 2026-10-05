import type { AffineMatrix, CameraKeyframe, DrawingElement, Layer } from "../model/types.js";
import type { ShotAnimation } from "../model/types/shot.js";
import { CodeboardError } from "../model/errors.js";
import { invertMatrix, matrixFromTransform, multiplyMatrices } from "../drawing/math.js";
import { evaluateCamera, evaluateLayer } from "./evaluate.js";
import { cameraPlane } from "./camera-plane.js";
import { controlledShotLayers } from "./controllers.js";
import { defineShotAnimation } from "./shot.js";

export interface CoordinateOptions {
  frame?: number;
  camera?: boolean;
}
export interface ArtworkCoordinateSpace {
  layerId: string;
  rootLayerId: string;
  targetId: string;
  frame: number;
  localToFrame: AffineMatrix;
  frameToLocal: AffineMatrix | null;
  parentToFrame: AffineMatrix;
  frameToParent: AffineMatrix | null;
}
export interface ShotCoordinateSpace extends ArtworkCoordinateSpace {
  animationId: string;
}

export function locateArtwork(
  layers: readonly Layer[],
  id: string,
  ancestors: Layer[] = [],
): { path: Layer[]; element?: DrawingElement } | undefined {
  for (const layer of layers) {
    const path = [...ancestors, layer];
    if (layer.id === id) return { path };
    if (layer.kind === "group") {
      const found = locateArtwork(layer.children, id, path);
      if (found) return found;
    } else {
      const element = layer.elements.find((item) => item.id === id);
      if (element) return { path, element };
    }
  }
  return undefined;
}
function inverse(matrix: AffineMatrix): AffineMatrix | null {
  try {
    return invertMatrix(matrix);
  } catch {
    return null;
  } // Singular transforms still support forward mapping.
}

/** Internal geometry query for validated board or shot artwork. */
export function artworkCoordinates(
  layers: readonly Layer[],
  cameraKeys: readonly CameraKeyframe[],
  width: number,
  height: number,
  targetId: string,
  frame: number,
  camera: boolean,
): ArtworkCoordinateSpace | undefined {
  const found = locateArtwork(layers, targetId);
  if (!found) return undefined;
  if (!Number.isSafeInteger(frame))
    throw new CodeboardError("INVALID_ARGUMENT", "Coordinate frame must be a safe integer");
  let localToFrame: AffineMatrix = camera
    ? cameraPlane(
        evaluateCamera(cameraKeys, frame),
        evaluateLayer(found.path[0]!, frame).depth,
        width,
        height,
      ).matrix
    : [1, 0, 0, 1, 0, 0];
  let parentToFrame = localToFrame;
  for (const layer of found.path) {
    parentToFrame = localToFrame;
    localToFrame = multiplyMatrices(
      localToFrame,
      matrixFromTransform(evaluateLayer(layer, frame).transform, layer.pivot),
    );
  }
  if (found.element) {
    parentToFrame = localToFrame;
    if (found.element.matrix) localToFrame = multiplyMatrices(localToFrame, found.element.matrix);
  }
  return {
    layerId: found.path.at(-1)!.id,
    rootLayerId: found.path[0]!.id,
    targetId,
    frame,
    localToFrame: [...localToFrame],
    frameToLocal: inverse(localToFrame),
    parentToFrame: [...parentToFrame],
    frameToParent: inverse(parentToFrame),
  };
}

export function shotCoordinates(
  input: ShotAnimation,
  targetId: string,
  options: CoordinateOptions = {},
): ShotCoordinateSpace {
  const animation = defineShotAnimation(input);
  const boundLayers = new Set(animation.meshes?.map((entry) => entry.layerId));
  const deformed = locateArtwork(animation.layers, targetId)?.path.find((layer) =>
    boundLayers.has(layer.id),
  );
  if (deformed)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Deformed artwork cannot be described by affine coordinate matrices",
      {
        details: {
          reason: "NON_AFFINE_COORDINATES",
          animationId: animation.id,
          targetId,
          layerId: deformed.id,
        },
      },
    );
  const space = artworkCoordinates(
    controlledShotLayers(animation, options.frame ?? 0),
    animation.cameraKeyframes,
    animation.canvas.width,
    animation.canvas.height,
    targetId,
    options.frame ?? 0,
    options.camera !== false,
  );
  if (!space)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      `Coordinate target is not a layer or drawing element in animation ${animation.id}: ${targetId}`,
    );
  return { animationId: animation.id, ...space };
}
