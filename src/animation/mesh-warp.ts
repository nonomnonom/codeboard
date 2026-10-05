import { CodeboardError } from "../model/errors.js";
import { prepareTriangleWarp, queryTriangleWarp } from "./triangle-warp.js";

export interface IndexedMeshWarp {
  source: readonly { readonly x: number; readonly y: number }[];
  destination: readonly { readonly x: number; readonly y: number }[];
  triangles: readonly (readonly [number, number, number])[];
}

/** Check indexed topology before preparing any triangle transforms. */
export function prepareIndexedMeshWarp(mesh: IndexedMeshWarp) {
  if (mesh.triangles.length > 4096 || mesh.source.length > 12288)
    throw new CodeboardError("RESOURCE_LIMIT", "Mesh exceeds the warp geometry budget", {
      details: {
        reason: "MESH_GEOMETRY_LIMIT",
        triangles: mesh.triangles.length,
        vertices: mesh.source.length,
      },
    });
  if (mesh.source.length !== mesh.destination.length)
    throw new CodeboardError("INVALID_ARGUMENT", "Mesh source and destination counts must match", {
      details: { reason: "MESH_VERTEX_COUNT" },
    });
  for (const [space, vertices] of [
    ["source", mesh.source],
    ["destination", mesh.destination],
  ] as const)
    for (const [vertexIndex, point] of vertices.entries())
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
        throw new CodeboardError("INVALID_ARGUMENT", "Mesh vertices must be finite", {
          details: { reason: "MESH_VERTEX_RANGE", space, vertexIndex },
        });
  const faces = new Set<string>();
  const edges = new Map<string, { from: number; to: number; count: number }>();
  for (const [triangleIndex, indices] of mesh.triangles.entries()) {
    if (
      indices.length !== 3 ||
      indices.some((id) => !Number.isSafeInteger(id) || id < 0 || id >= mesh.source.length) ||
      new Set(indices).size !== 3
    )
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Mesh triangle requires three distinct valid indices",
        {
          details: { reason: "MESH_TRIANGLE_INDICES", triangleIndex },
        },
      );
    const face = [...indices].sort((a, b) => a - b).join(":");
    if (faces.has(face))
      throw new CodeboardError("INVALID_ARGUMENT", "Mesh contains a duplicate triangle", {
        details: { reason: "MESH_DUPLICATE_TRIANGLE", triangleIndex },
      });
    faces.add(face);
    for (let i = 0; i < 3; i++) {
      const from = indices[i]!,
        to = indices[(i + 1) % 3]!;
      const key = `${Math.min(from, to)}:${Math.max(from, to)}`;
      const existing = edges.get(key);
      if (existing && (existing.count === 2 || existing.from === from))
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Mesh edge is non-manifold or inconsistently wound",
          {
            details: { reason: "MESH_EDGE_TOPOLOGY", triangleIndex, edge: [from, to] },
          },
        );
      if (existing) existing.count++;
      else edges.set(key, { from, to, count: 1 });
    }
  }
  return mesh.triangles.map(([a, b, c], triangleIndex) => {
    try {
      return prepareTriangleWarp(
        [mesh.source[a]!, mesh.source[b]!, mesh.source[c]!],
        [mesh.destination[a]!, mesh.destination[b]!, mesh.destination[c]!],
      );
    } catch (cause) {
      if (cause instanceof CodeboardError)
        throw new CodeboardError(cause.code, cause.message, {
          details: { ...cause.details, triangleIndex },
          cause,
        });
      throw cause;
    }
  });
}

/** Return every candidate, including shared-edge hits and overlaps; never pick an inverse silently. */
export function queryIndexedMeshWarp(
  prepared: ReturnType<typeof prepareIndexedMeshWarp>,
  point: { x: number; y: number },
  direction: "forward" | "inverse",
) {
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    !["forward", "inverse"].includes(direction)
  )
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid mesh point query", {
      details: { reason: "MESH_QUERY_INPUT" },
    });
  return prepared.flatMap((triangle, triangleIndex) => {
    const result = queryTriangleWarp(triangle, point, direction);
    return result === null ? [] : [{ triangleIndex, ...result }];
  });
}
