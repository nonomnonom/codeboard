import { z } from "zod";
import type { PageOptions } from "../model/types.js";
import type { ShotAnimation } from "../model/types/shot.js";
import { CodeboardError } from "../model/errors.js";
import { boundQueryResponse, pageBounds } from "../model/query.js";
import { allLayers } from "../model/layers.js";
import { defineShotAnimation } from "./shot.js";
import { createControlledLayerEvaluator, evaluateControllerWeight } from "./controllers.js";

export type ShotControllerQuery = PageOptions & {
  collection: "targets" | "keyframes";
  frame?: number;
};
const querySchema = z
  .object({
    collection: z.enum(["targets", "keyframes"]),
    frame: z.number().int().safe().optional(),
    offset: z.number().int().nonnegative().safe().optional(),
    limit: z.number().int().positive().safe().optional(),
  })
  .strict();

/** Inspect detached controller records and optional final, fully blended layer states. */
export function shotControllerData(
  input: ShotAnimation,
  controllerId: string,
  query: ShotControllerQuery = { collection: "keyframes" },
) {
  const parsed = querySchema.safeParse(query);
  if (
    !parsed.success ||
    typeof controllerId !== "string" ||
    !controllerId.length ||
    controllerId.length > 4096
  )
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid controller inspection query", {
      details: {
        reason: "CONTROLLER_QUERY",
        ...(!parsed.success ? { issues: parsed.error.issues } : {}),
      },
    });
  const options = parsed.data;
  const { offset, limit } = pageBounds({ offset: options.offset ?? 0, limit: options.limit ?? 50 });
  const animation = defineShotAnimation(input);
  const stackIndex = animation.controllers?.findIndex((entry) => entry.id === controllerId) ?? -1;
  const controller = animation.controllers?.[stackIndex];
  if (!controller)
    throw new CodeboardError("INVALID_ARGUMENT", "Controller not found", {
      details: { reason: "CONTROLLER_MISSING", animationId: animation.id, controllerId },
    });
  const metadata = {
    animationId: animation.id,
    controllerId,
    name: controller.name,
    mode: controller.mode,
    stackIndex,
    staticWeight: controller.weight,
    activeRange: controller.activeRange === undefined ? null : { ...controller.activeRange },
    frame: options.frame ?? null,
    evaluatedWeight:
      options.frame === undefined ? null : evaluateControllerWeight(controller, options.frame),
    counts: { targets: controller.targets.length, keyframes: controller.keyframes.length },
    offset,
    limit,
  };
  const finish = <T>(collection: ShotControllerQuery["collection"], total: number, items: T[]) =>
    boundQueryResponse(
      {
        ...metadata,
        collection,
        total,
        nextOffset: offset + items.length < total ? offset + items.length : null,
        items,
      },
      "Controller page",
    );
  if (options.collection === "keyframes")
    return finish(
      "keyframes",
      controller.keyframes.length,
      controller.keyframes
        .slice(offset, offset + limit)
        .map((key, index) => ({ index: offset + index, ...structuredClone(key) })),
    );
  const layers = new Map(allLayers(animation.layers).map((layer) => [layer.id, layer]));
  const evaluate = createControlledLayerEvaluator(animation);
  return finish(
    "targets",
    controller.targets.length,
    controller.targets.slice(offset, offset + limit).map((target, index) => ({
      index: offset + index,
      ...structuredClone(target),
      evaluatedState:
        options.frame === undefined ? null : evaluate(layers.get(target.layerId)!, options.frame),
    })),
  );
}
