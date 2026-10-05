import type { Layer, LayerChannel } from "../model/types.js";
import type { ShotAnimation } from "../model/types/shot.js";
import type { ShotController } from "../model/types/controllers.js";
import { allLayers } from "../model/layers.js";
import { CodeboardError } from "../model/errors.js";
import { evaluateLayer, evaluateKeyedNumber } from "./evaluate.js";
import { interpolateNumber } from "../drawing/math.js";

export function validateShotControllers(animation: ShotAnimation): void {
  const layers = new Set(allLayers(animation.layers).map((layer) => layer.id));
  validateControllerDefinitions(animation.controllers ?? [], layers);
}

export function validateControllerDefinitions(
  controllers: readonly ShotController[],
  layers: ReadonlySet<string>,
): void {
  const ids = new Set<string>();
  for (const controller of controllers) {
    if (ids.has(controller.id))
      throw new CodeboardError("INVALID_ARGUMENT", "Duplicate controller ID");
    ids.add(controller.id);
    const targets = new Set<string>();
    for (const target of controller.targets) {
      if (!layers.has(target.layerId) || targets.has(target.layerId))
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Controller requires distinct existing target layers",
          {
            details: {
              reason: "CONTROLLER_TARGET",
              controllerId: controller.id,
              layerId: target.layerId,
            },
          },
        );
      targets.add(target.layerId);
    }
    let previous: number | undefined;
    for (const key of controller.keyframes) {
      if (previous !== undefined && key.frame <= previous)
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Controller keys must have unique ascending frames",
          {
            details: {
              reason: "CONTROLLER_KEY_ORDER",
              controllerId: controller.id,
              frame: key.frame,
            },
          },
        );
      previous = key.frame;
    }
  }
}

/** Evaluate stored controllers in array order after ordinary layer keys. */
export function createControlledLayerEvaluator(animation: ShotAnimation) {
  const targets = new Map<
    string,
    { controller: ShotController; values: ShotController["targets"][number]["values"] }[]
  >();
  for (const controller of animation.controllers ?? [])
    for (const target of controller.targets) {
      const entries = targets.get(target.layerId) ?? [];
      entries.push({ controller, values: target.values });
      targets.set(target.layerId, entries);
    }
  return (layer: Layer, frame: number) => {
    const state = evaluateLayer(layer, frame);
    for (const { controller, values } of targets.get(layer.id) ?? []) {
      const weight = evaluateControllerWeight(controller, frame);
      for (const channel of Object.keys(values) as LayerChannel[]) {
        const value = values[channel];
        if (value === undefined || weight === 0) continue;
        const base =
          channel === "opacity" || channel === "depth" ? state[channel] : state.transform[channel];
        const result =
          controller.mode === "replace"
            ? interpolateNumber(base, value, weight)
            : base + weight * value;
        if (
          !Number.isFinite(result) ||
          (channel === "opacity" && (result < 0 || result > 1)) ||
          (channel === "depth" && result <= 0)
        )
          throw new CodeboardError(
            "INVALID_ARGUMENT",
            "Controller produced an invalid layer channel",
            {
              details: {
                reason: "CONTROLLER_RESULT",
                controllerId: controller.id,
                layerId: layer.id,
                channel,
                frame,
              },
            },
          );
        if (channel === "opacity" || channel === "depth") state[channel] = result;
        else state.transform[channel] = result;
      }
    }
    return state;
  };
}

export function controlledShotLayers(animation: ShotAnimation, frame: number): Layer[] {
  if (!animation.controllers?.length) return animation.layers;
  const evaluate = createControlledLayerEvaluator(animation);
  const visit = (layers: Layer[]): Layer[] =>
    layers.map((layer) => ({
      ...layer,
      ...evaluate(layer, frame),
      keyframes: [],
      ...(layer.kind === "group" ? { children: visit(layer.children) } : {}),
    }));
  return visit(animation.layers);
}

export function evaluateControllerWeight(controller: ShotController, frame: number): number {
  if (
    controller.activeRange &&
    (frame < controller.activeRange.startFrame || frame >= controller.activeRange.endFrame)
  )
    return 0;
  return evaluateKeyedNumber(
    controller.keyframes,
    frame,
    (key) => key.weight,
    (key) => key.easing,
    controller.weight,
  );
}
