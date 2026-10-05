import {
  prepareBoardLayerKeyframe,
  omitBoardLayerKeyframeChannels,
} from "../../animation/board-keyframes.js";
import type { LayerKeyframeInput, LayerKeyframeChanges } from "../../model/types.js";
import { validateRigLayerChange } from "../../model/validation/rig.js";
import type { Id, PageOptions, LayerChannel } from "../../model/types.js";
import { layerKeyframeSchema } from "../../model/schema/animation.js";
import {
  validateKeyframePositions,
  validateLayerEffectKeys,
} from "../../model/validation/artwork.js";
import type { ProductionHost, MutationOptions } from "./host.js";
import { findLayer } from "../../model/layers.js";

type Host = Pick<ProductionHost, "_applyProduction" | "_readLayerKeyframes">;

export function layerKeyframes(host: Host, id: Id, options: PageOptions = {}) {
  return host._readLayerKeyframes(id, options);
}

export function addLayerKeyframe(
  host: Host,
  layerId: Id,
  frame: number,
  value: LayerKeyframeInput,
  options: MutationOptions = {},
): Id {
  let id = "";
  host._applyProduction(
    "add layer keyframe",
    [layerId],
    options.expectedVersion,
    (document, nextId) => {
      const { panel, layer } = findLayer(document, layerId);
      const existing = layer.keyframes.find((key) => key.frame === frame);
      const keyframe = prepareBoardLayerKeyframe(frame, value, existing);
      if (keyframe.depth !== undefined && !panel.layers.includes(layer))
        throw new Error("Depth keyframes require a top-level plane");
      validateLayerEffectKeys({ ...layer, keyframes: [keyframe] });
      validateRigLayerChange(panel.layers, {
        ...layer,
        keyframes: [...layer.keyframes.filter((entry) => entry.frame !== frame), keyframe],
      });
      id = existing?.id ?? nextId("layer-key");
      layer.keyframes = [
        ...layer.keyframes.filter((entry) => entry.frame !== frame),
        { ...keyframe, id },
      ].sort((a, b) => a.frame - b.frame);
    },
    { layerId },
  );
  return id;
}

export function updateLayerKeyframe(
  host: Host,
  layerId: Id,
  keyframeId: Id,
  changes: LayerKeyframeChanges,
  options: MutationOptions = {},
): void {
  host._applyProduction(
    "update layer keyframe",
    [layerId, keyframeId],
    options.expectedVersion,
    (document) => {
      const { panel, layer } = findLayer(document, layerId);
      const keyframe = layer.keyframes.find((entry) => entry.id === keyframeId);
      if (!keyframe) throw new Error(`Layer keyframe not found: ${keyframeId}`);
      const proposed = layerKeyframeSchema.parse({ ...keyframe, ...changes, id: keyframe.id });
      if (proposed.depth !== undefined && !panel.layers.includes(layer))
        throw new Error("Depth keyframes require a top-level plane");
      const keys = layer.keyframes.map((entry) => (entry.id === keyframeId ? proposed : entry));
      validateKeyframePositions(keys, layerId);
      validateLayerEffectKeys({ ...layer, keyframes: keys });
      validateRigLayerChange(panel.layers, { ...layer, keyframes: keys });
      layer.keyframes = keys.sort((a, b) => a.frame - b.frame);
    },
    { layerId },
  );
}

export function removeLayerKeyframe(
  host: Host,
  layerId: Id,
  keyframeId: Id,
  options: MutationOptions = {},
): void {
  host._applyProduction(
    "remove layer keyframe",
    [layerId, keyframeId],
    options.expectedVersion,
    (document) => {
      const { layer } = findLayer(document, layerId);
      if (!layer.keyframes.some((entry) => entry.id === keyframeId))
        throw new Error(`Layer keyframe not found: ${keyframeId}`);
      layer.keyframes = layer.keyframes.filter((entry) => entry.id !== keyframeId);
    },
    { layerId },
  );
}

export function removeLayerKeyframeChannels(
  host: Host,
  layerId: Id,
  keyframeId: Id,
  channels: readonly LayerChannel[],
  options: MutationOptions = {},
) {
  if (
    !channels.length ||
    new Set(channels).size !== channels.length ||
    channels.some(
      (channel) =>
        !["x", "y", "scaleX", "scaleY", "rotation", "opacity", "depth"].includes(channel),
    )
  )
    throw new Error("Keyframe channels must be nonempty, unique supported property names");
  host._applyProduction(
    "remove keyframe channels",
    [layerId, keyframeId],
    options.expectedVersion,
    (d) => {
      const { layer } = findLayer(d, layerId),
        key = layer.keyframes.find((k) => k.id === keyframeId);
      if (!key) throw new Error(`Layer keyframe not found: ${keyframeId}`);
      const proposed = omitBoardLayerKeyframeChannels(key, channels);
      layer.keyframes =
        proposed === null
          ? layer.keyframes.filter((k) => k.id !== keyframeId)
          : layer.keyframes.map((k) => (k.id === keyframeId ? proposed : k));
    },
    { layerId },
  );
}
