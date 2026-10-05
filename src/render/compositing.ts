import { Canvas } from "skia-canvas";
import type { ShotCompositeGraph } from "../model/types/compositing.js";
import { orderCompositeGraph } from "../model/validation/compositing.js";
import { validateDimensions } from "../model/validation/pixels.js";
import { CodeboardError } from "../model/errors.js";
import { applyLayerEffects, prepareEffectStack } from "./layer-effects.js";
import { evaluateEffectStack } from "../animation/effects.js";
import { evaluateKeyedNumber } from "../animation/evaluate.js";

/** Compile only validated graph data; each source callback returns a newly owned transparent frame. */
export function createShotCompositor(graph: ShotCompositeGraph, width: number, height: number) {
  validateDimensions(width, height);
  const nodes = orderCompositeGraph(graph);
  const prepared = new Map(
    nodes.flatMap((node) =>
      node.kind === "effects" && !node.keyframes?.length
        ? [[node.id, prepareEffectStack(node.effects, 1, { nodeId: node.id })] as const]
        : [],
    ),
  );
  const passes =
    1 +
    nodes.reduce(
      (sum, node) => sum + (node.kind === "effects" ? Math.max(1, node.effects.length) : 1),
      0,
    );
  if (width * height * passes > 256 * 1024 * 1024)
    throw new CodeboardError(
      "RESOURCE_LIMIT",
      "Compositing graph exceeds 256 megapixel-passes per frame",
      {
        details: { width, height, passes },
      },
    );
  return (
    source: (layerIds: readonly string[]) => Canvas,
    background: string,
    frame: number,
  ): Canvas => {
    const surfaces = new Map<string, Canvas>();
    let output: Canvas | undefined;
    try {
      for (const node of nodes) {
        if (node.kind === "source") {
          surfaces.set(node.id, source(node.layerIds));
          continue;
        }
        if (node.kind === "effects") {
          // Graph ports are cropped frame images, unlike spatial layer surfaces. Outside is transparent.
          const filtered = applyLayerEffects(
            surfaces.get(node.input)!,
            (
              prepared.get(node.id) ??
              prepareEffectStack(
                evaluateEffectStack(node.effects, node.keyframes ?? [], frame),
                1,
                { nodeId: node.id, frame },
              )
            ).filters,
          );
          surfaces.set(node.id, filtered);
          continue;
        }
        const canvas = new Canvas(width, height);
        surfaces.set(node.id, canvas);
        const ctx = canvas.getContext("2d");
        if (node.kind === "blend") {
          ctx.drawImage(surfaces.get(node.background)!, 0, 0);
          ctx.globalAlpha = evaluateKeyedNumber(
            node.keyframes ?? [],
            frame,
            (key) => key.opacity,
            (key) => key.easing,
            node.opacity,
          );
          ctx.globalCompositeOperation = node.mode;
          ctx.drawImage(surfaces.get(node.foreground)!, 0, 0);
        } else {
          ctx.drawImage(surfaces.get(node.input)!, 0, 0);
          ctx.globalCompositeOperation = node.mode === "in" ? "destination-in" : "destination-out";
          ctx.drawImage(surfaces.get(node.mask)!, 0, 0);
        }
      }
      output = new Canvas(width, height);
      const ctx = output.getContext("2d");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(surfaces.get(graph.output)!, 0, 0);
      return output;
    } catch (error) {
      output?.getContext("2d").reset();
      throw error;
    } finally {
      for (const surface of new Set(surfaces.values())) surface.getContext("2d").reset();
    }
  };
}
