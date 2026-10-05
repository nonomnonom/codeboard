import { z } from "zod";
import type { AffineMatrix } from "../model/types.js";
import type { ShotAnimation } from "../model/types/shot.js";
import { CodeboardError } from "../model/errors.js";
import { boundQueryResponse } from "../model/query.js";
import { invertMatrix, matrixFromTransform, transformPoint } from "../drawing/math.js";
import { locateArtwork, type CoordinateOptions } from "./coordinates.js";
import { controlledShotLayers } from "./controllers.js";
import { defineShotAnimation } from "./shot.js";
import { evaluateCamera, evaluateLayer } from "./evaluate.js";
import { cameraPlane } from "./camera-plane.js";
import { createBoundMeshEvaluator } from "./mesh-binding.js";
import { prepareIndexedMeshWarp, queryIndexedMeshWarp } from "./mesh-warp.js";

export interface ShotPointOptions extends CoordinateOptions {
  direction: "localToFrame" | "frameToLocal";
}
export interface ShotPointCandidate {
  point: { x: number; y: number };
  faces: { layerId: string; triangleIndex: number; weights: number[] }[];
}
const querySchema = z
  .object({
    targetId: z.string().min(1).max(4096),
    point: z.object({ x: z.number().finite(), y: z.number().finite() }).strict(),
    options: z
      .object({
        direction: z.enum(["localToFrame", "frameToLocal"]),
        frame: z.number().int().safe().default(0),
        camera: z.boolean().default(true),
      })
      .strict(),
  })
  .strict();

/** Map geometry through the ordered deformation stack; preserve every face candidate. */
export function shotPointCoordinates(
  input: ShotAnimation,
  targetId: string,
  point: { x: number; y: number },
  options: ShotPointOptions,
) {
  const parsed = querySchema.safeParse({ targetId, point, options });
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid shot point query", {
      details: { reason: "SHOT_POINT_QUERY", issues: parsed.error.issues },
    });
  const query = parsed.data;
  const { frame, direction, camera } = query.options;
  const animation = defineShotAnimation(input);
  const found = locateArtwork(controlledShotLayers(animation, frame), query.targetId);
  if (!found)
    throw new CodeboardError("INVALID_ARGUMENT", "Shot point target not found", {
      details: { animationId: animation.id, targetId: query.targetId },
    });
  type Step =
    | { kind: "affine"; matrix: AffineMatrix; ownerId: string }
    | { kind: "mesh"; mesh: ReturnType<typeof prepareIndexedMeshWarp>; ownerId: string };
  const steps: Step[] = [];
  if (found.element?.matrix)
    steps.push({ kind: "affine", matrix: found.element.matrix, ownerId: found.element.id });
  const bindings = new Map(animation.meshes?.map((binding) => [binding.layerId, binding]));
  for (const layer of [...found.path].reverse()) {
    const binding = bindings.get(layer.id);
    if (binding)
      steps.push({
        kind: "mesh",
        ownerId: layer.id,
        mesh: prepareIndexedMeshWarp(createBoundMeshEvaluator(binding, animation)(frame)),
      });
    steps.push({
      kind: "affine",
      ownerId: layer.id,
      matrix: matrixFromTransform(evaluateLayer(layer, frame).transform, layer.pivot),
    });
  }
  if (camera)
    steps.push({
      kind: "affine",
      ownerId: animation.id,
      matrix: cameraPlane(
        evaluateCamera(animation.cameraKeyframes, frame),
        evaluateLayer(found.path[0]!, frame).depth,
        animation.canvas.width,
        animation.canvas.height,
      ).matrix,
    });
  const inverse = direction === "frameToLocal";
  if (inverse) steps.reverse();
  let candidates: ShotPointCandidate[] = [{ point: query.point, faces: [] }];
  for (const step of steps) {
    if (!candidates.length) break;
    try {
      if (step.kind === "affine") {
        const matrix = inverse ? invertMatrix(step.matrix) : step.matrix;
        candidates = candidates.map((entry) => ({
          ...entry,
          point: transformPoint(matrix, entry.point),
        }));
      } else {
        const next: ShotPointCandidate[] = [];
        for (const candidate of candidates)
          for (const hit of queryIndexedMeshWarp(
            step.mesh,
            candidate.point,
            inverse ? "inverse" : "forward",
          )) {
            if (next.length >= 4096)
              throw new CodeboardError(
                "RESOURCE_LIMIT",
                "Shot point query exceeds 4096 candidates",
                {
                  details: { reason: "SHOT_POINT_CANDIDATES" },
                },
              );
            next.push({
              point: hit.point,
              faces: [
                ...candidate.faces,
                { layerId: step.ownerId, triangleIndex: hit.triangleIndex, weights: hit.weights },
              ],
            });
          }
        candidates = next;
      }
      boundQueryResponse(candidates, "Shot point candidates");
    } catch (cause) {
      throw new CodeboardError(
        cause instanceof CodeboardError ? cause.code : "INVALID_ARGUMENT",
        cause instanceof Error ? cause.message : "Shot point mapping failed",
        {
          details: {
            ...(cause instanceof CodeboardError
              ? cause.details
              : { reason: "SHOT_POINT_TRANSFORM" }),
            animationId: animation.id,
            targetId: query.targetId,
            ownerId: step.ownerId,
            frame,
            direction,
          },
          cause,
        },
      );
    }
  }
  return boundQueryResponse(
    { animationId: animation.id, targetId: query.targetId, frame, direction, candidates },
    "Shot point query",
  );
}
