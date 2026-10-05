import { z } from "zod";
import type { PageOptions } from "../model/types.js";
import type { ShotAnimation } from "../model/types/shot.js";
import { CodeboardError } from "../model/errors.js";
import { boundQueryResponse, pageBounds } from "../model/query.js";
import { defineShotAnimation } from "./shot.js";
import { createBoundMeshEvaluator } from "./mesh-binding.js";
import { bakeCurveMesh } from "./curve-mesh.js";
import { bakeEnvelopeMesh } from "./envelope-mesh.js";

export type ShotMeshQuery = PageOptions &
  (
    | { collection: "vertices"; frame?: number }
    | { collection: "triangles" | "keyframes" | "joints" | "weights" }
  );
const page = {
  offset: z.number().int().nonnegative().safe().optional(),
  limit: z.number().int().positive().safe().optional(),
};
const querySchema = z.discriminatedUnion("collection", [
  z
    .object({
      ...page,
      collection: z.literal("vertices"),
      frame: z.number().int().safe().optional(),
    })
    .strict(),
  z.object({ ...page, collection: z.literal("joints") }).strict(),
  z.object({ ...page, collection: z.literal("weights") }).strict(),
  z.object({ ...page, collection: z.literal("triangles") }).strict(),
  z.object({ ...page, collection: z.literal("keyframes") }).strict(),
]);

/** Page detached mesh geometry or key metadata without returning the entire pose track. */
export function shotMeshData(
  input: ShotAnimation,
  layerId: string,
  query: ShotMeshQuery = { collection: "keyframes" },
) {
  const parsed = querySchema.safeParse(query);
  if (!parsed.success || typeof layerId !== "string" || !layerId.length || layerId.length > 4096)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid mesh inspection query", {
      details: {
        reason: "MESH_INSPECTION_QUERY",
        ...(!parsed.success ? { issues: parsed.error.issues } : {}),
      },
    });
  const options = parsed.data;
  const { offset, limit } = pageBounds({ offset: options.offset ?? 0, limit: options.limit ?? 50 });
  const animation = defineShotAnimation(input);
  const binding = animation.meshes?.find((entry) => entry.layerId === layerId);
  if (!binding)
    throw new CodeboardError("INVALID_ARGUMENT", "Layer has no mesh binding", {
      details: { reason: "MESH_BINDING_MISSING", animationId: animation.id, layerId },
    });
  const mesh =
    binding.mesh !== undefined
      ? binding.mesh
      : binding.curve !== undefined
        ? bakeCurveMesh(binding.curve)
        : binding.envelope !== undefined
          ? bakeEnvelopeMesh(binding.envelope)
          : { source: binding.skin.source, triangles: binding.skin.triangles, keyframes: [] };
  const finish = <C extends ShotMeshQuery["collection"], T>(
    collection: C,
    total: number,
    items: T[],
  ) => ({
    animationId: animation.id,
    layerId,
    bindingKind:
      binding.skin !== undefined
        ? ("skin" as const)
        : binding.mesh !== undefined
          ? ("mesh" as const)
          : binding.curve !== undefined
            ? ("curve" as const)
            : ("envelope" as const),
    curveRest: binding.curve === undefined ? null : structuredClone(binding.curve.rest),
    curveSegments: binding.curve === undefined ? null : (binding.curve.segments ?? 32),
    envelopeRest: binding.envelope === undefined ? null : structuredClone(binding.envelope.rest),
    envelopeGrid:
      binding.envelope === undefined
        ? null
        : { columns: binding.envelope.columns ?? 8, rows: binding.envelope.rows ?? 8 },
    collection,
    offset,
    limit,
    total,
    nextOffset: offset + items.length < total ? offset + items.length : null,
    counts: {
      joints: binding.skin?.joints.length ?? 0,
      weights: binding.skin?.weights.length ?? 0,
      vertices: mesh.source.length,
      triangles: mesh.triangles.length,
      keyframes: mesh.keyframes.length,
    },
    items,
  });
  if (options.collection === "joints")
    return boundQueryResponse(
      finish(
        "joints",
        binding.skin?.joints.length ?? 0,
        (binding.skin?.joints ?? []).slice(offset, offset + limit).map((joint, index) => ({
          index: offset + index,
          ...structuredClone(joint),
          layerId: binding.skin!.jointLayers.find((mapping) => mapping.jointId === joint.id)!
            .layerId,
        })),
      ),
      "Skin joint page",
    );
  if (options.collection === "weights")
    return boundQueryResponse(
      finish(
        "weights",
        binding.skin?.weights.length ?? 0,
        (binding.skin?.weights ?? []).slice(offset, offset + limit).map((weights, index) => ({
          index: offset + index,
          influences: structuredClone(weights),
        })),
      ),
      "Skin weight page",
    );
  if (options.collection === "triangles")
    return boundQueryResponse(
      finish(
        "triangles",
        mesh.triangles.length,
        mesh.triangles
          .slice(offset, offset + limit)
          .map((indices, index) => ({ index: offset + index, vertices: [...indices] })),
      ),
      "Mesh triangle page",
    );
  if (options.collection === "keyframes" && binding.curve !== undefined)
    return boundQueryResponse(
      finish(
        "keyframes",
        binding.curve.keyframes.length,
        binding.curve.keyframes
          .slice(offset, offset + limit)
          .map((key, index) => ({ index: offset + index, ...structuredClone(key) })),
      ),
      "Curve keyframe page",
    );
  if (options.collection === "keyframes" && binding.envelope !== undefined)
    return boundQueryResponse(
      finish(
        "keyframes",
        binding.envelope.keyframes.length,
        binding.envelope.keyframes
          .slice(offset, offset + limit)
          .map((key, index) => ({ index: offset + index, ...structuredClone(key) })),
      ),
      "Envelope keyframe page",
    );
  if (options.collection === "keyframes")
    return boundQueryResponse(
      finish(
        "keyframes",
        mesh.keyframes.length,
        mesh.keyframes.slice(offset, offset + limit).map(({ frame, easing }, index) => ({
          index: offset + index,
          frame,
          easing: structuredClone(easing),
        })),
      ),
      "Mesh keyframe page",
    );
  let vertices = mesh.source;
  if (options.frame !== undefined) {
    try {
      vertices = createBoundMeshEvaluator(binding, animation)(options.frame).destination;
    } catch (cause) {
      if (cause instanceof CodeboardError)
        throw new CodeboardError(cause.code, cause.message, {
          details: { ...cause.details, animationId: animation.id, layerId, frame: options.frame },
          cause,
        });
      throw cause;
    }
  }
  return boundQueryResponse(
    {
      ...finish(
        "vertices",
        vertices.length,
        vertices
          .slice(offset, offset + limit)
          .map((point, index) => ({ index: offset + index, ...point })),
      ),
      frame: options.frame ?? null,
    },
    "Mesh vertex page",
  );
}
