import type { ShotCompositeGraph, ShotCompositeNode } from "../types/compositing.js";
import { CodeboardError } from "../errors.js";
import { validateEffectValues } from "./effects.js";
import { validateKeyframePositions } from "./keyframes.js";

export function validateCompositeSources(
  graph: ShotCompositeGraph,
  layerIds: ReadonlySet<string>,
  animationId: string,
): void {
  for (const node of graph.nodes) {
    if (node.kind !== "source") continue;
    for (const layerId of node.layerIds)
      if (!layerIds.has(layerId))
        throw new CodeboardError("INVALID_ARGUMENT", "Compositing source layer does not exist", {
          details: { animationId, nodeId: node.id, layerId },
        });
  }
}

/** Validate local identities/dependencies and return each reachable node once, inputs first. */
export function orderCompositeGraph(graph: ShotCompositeGraph): ShotCompositeNode[] {
  for (const node of graph.nodes) {
    if (node.kind !== "effects" && node.kind !== "blend") continue;
    validateKeyframePositions(node.keyframes ?? [], `compositing node ${node.id}`);
    if (node.kind === "effects")
      for (const key of node.keyframes ?? [])
        validateEffectValues(node.effects, key.effectValues, { nodeId: node.id, frame: key.frame });
  }
  if (Buffer.byteLength(JSON.stringify(graph)) > 32768)
    throw new CodeboardError("RESOURCE_LIMIT", "Shot compositing graph exceeds 32 KiB");
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  if (nodes.size !== graph.nodes.length)
    throw new CodeboardError("INVALID_ARGUMENT", "Compositing node IDs must be unique");
  const visiting = new Set<string>(),
    visited = new Set<string>();
  const ordered: ShotCompositeNode[] = [];
  function visit(id: string) {
    if (visiting.has(id))
      throw new CodeboardError("INVALID_ARGUMENT", "Compositing graph contains a cycle", {
        details: { nodeId: id },
      });
    if (visited.has(id)) return;
    const node = nodes.get(id);
    if (!node)
      throw new CodeboardError("INVALID_ARGUMENT", "Compositing node does not exist", {
        details: { nodeId: id },
      });
    visiting.add(id);
    if (node.kind === "effects") visit(node.input);
    else if (node.kind === "blend") {
      visit(node.background);
      visit(node.foreground);
    } else if (node.kind === "mask") {
      visit(node.input);
      visit(node.mask);
    }
    visiting.delete(id);
    visited.add(id);
    ordered.push(node);
  }
  visit(graph.output);
  if (visited.size !== nodes.size)
    throw new CodeboardError("INVALID_ARGUMENT", "Every compositing node must reach the output");
  return ordered;
}
