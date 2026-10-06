import type { ShotAnimation } from "../model/types/shot.js";
import type { CharacterInstanceOptions } from "../model/types/characters.js";
import { characterInstanceOptionsSchema } from "../model/schema/characters.js";
import { iterateLayers, layerBase } from "../model/layers.js";
import { CodeboardError } from "../model/errors.js";
import { defineShotAnimation } from "./shot.js";
import { cloneShotArtwork } from "./clone-shot-artwork.js";
import { scene3DKeyCollections } from "./scene3d.js";

/** Insert a self-contained character subtree into an existing shot, preserving its local performance. */
export function instantiateCharacterArtwork(
  source: ShotAnimation,
  target: ShotAnimation,
  input: CharacterInstanceOptions,
  nextId: (prefix: string) => string,
) {
  const parsed = characterInstanceOptionsSchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid character instance options", {
      details: { issues: parsed.error.issues },
    });
  const options = input;
  if (target.id !== options.targetAnimationId)
    throw new CodeboardError("INVALID_ARGUMENT", "Character target animation does not match");
  const root = source.layers.find((layer) => layer.id === options.rootLayerId);
  if (root?.kind !== "group")
    throw new CodeboardError("INVALID_ARGUMENT", "Character root must be a top-level group", {
      details: { reason: "CHARACTER_ROOT", rootLayerId: options.rootLayerId },
    });
  if (root.clipToBelow)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Character root cannot depend on the preceding sibling",
      { details: { reason: "CHARACTER_CLIP_DEPENDENCY" } },
    );
  if (
    BigInt(source.frameRate.numerator) * BigInt(target.frameRate.denominator) !==
    BigInt(target.frameRate.numerator) * BigInt(source.frameRate.denominator)
  )
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Character reuse requires equal frame rates; retime the master explicitly",
      { details: { reason: "CHARACTER_FRAME_RATE" } },
    );
  const offset = options.frameOffset ?? 0;
  const shifted = (frame: number) => {
    const result = Number(BigInt(frame) + BigInt(offset));
    if (!Number.isSafeInteger(result))
      throw new CodeboardError("RESOURCE_LIMIT", "Character timing exceeds the safe frame range");
    return result;
  };
  const endFrame = shifted(source.durationFrames);
  if (endFrame > target.durationFrames)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Character performance must fit inside the target shot",
      {
        details: {
          reason: "CHARACTER_DURATION",
          frameOffset: offset,
          durationFrames: source.durationFrames,
          targetDurationFrames: target.durationFrames,
        },
      },
    );
  const owned = new Set([...iterateLayers([root])].map((layer) => layer.id));
  const controllers = (source.controllers ?? []).filter((controller) =>
    controller.targets.some((entry) => owned.has(entry.layerId)),
  );
  const meshes = (source.meshes ?? []).filter((binding) => owned.has(binding.layerId));
  for (const binding of source.meshes ?? []) {
    if (
      !owned.has(binding.layerId) &&
      binding.skin?.jointLayers.some((joint) => owned.has(joint.layerId))
    )
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Character joints drive artwork outside the selected root",
        { details: { reason: "CHARACTER_EXTERNAL_DEPENDENCY", layerId: binding.layerId } },
      );
  }
  const copied = cloneShotArtwork({ layers: [root], controllers, meshes }, nextId);
  for (const layer of iterateLayers(copied.layers)) {
    for (const key of layer.keyframes) key.frame = shifted(key.frame);
    if (layer.exposure) {
      layer.exposure.startFrame = shifted(layer.exposure.startFrame);
      layer.exposure.endFrame = shifted(layer.exposure.endFrame);
    }
    if (layer.kind === "group") {
      for (const key of layer.drawingSequence ?? []) key.frame = shifted(key.frame);
    } else {
      for (const element of layer.elements) {
        if (element.kind === "scene-3d")
          for (const keys of scene3DKeyCollections(element.scene))
            for (const key of keys) key.frame = shifted(key.frame);
        if (element.kind === "raster-stroke" && element.reveal) {
          element.reveal.startFrame = shifted(element.reveal.startFrame);
          element.reveal.endFrame = shifted(element.reveal.endFrame);
        }
      }
    }
  }
  for (const controller of copied.controllers ?? []) {
    for (const key of controller.keyframes) key.frame = shifted(key.frame);
    if (controller.activeRange) {
      controller.activeRange.startFrame = shifted(controller.activeRange.startFrame);
      controller.activeRange.endFrame = shifted(controller.activeRange.endFrame);
    }
  }
  for (const binding of copied.meshes ?? []) {
    for (const key of binding.mesh?.keyframes ??
      binding.curve?.keyframes ??
      binding.envelope?.keyframes ??
      [])
      key.frame = shifted(key.frame);
  }
  const animation = structuredClone(target);
  const compositeSource = animation.compositing?.nodes.find(
    (node) => node.id === options.compositeSourceId,
  );
  if (
    (animation.compositing !== undefined || options.compositeSourceId !== undefined) &&
    compositeSource?.kind !== "source"
  )
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Composited character insertion requires a receiving source node",
      { details: { reason: "CHARACTER_COMPOSITE_SOURCE" } },
    );
  const parent =
    options.parentLayerId === undefined
      ? undefined
      : [...iterateLayers(animation.layers)].find((layer) => layer.id === options.parentLayerId);
  if (
    options.parentLayerId !== undefined &&
    (parent?.kind !== "group" || parent.drawingSequence !== undefined)
  )
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Character parent must be an existing group without drawing substitutions",
      { details: { reason: "CHARACTER_PARENT", parentLayerId: options.parentLayerId } },
    );
  const instance = {
    ...layerBase(options.id, options.name ?? root.name, {
      ...(options.transform === undefined ? {} : { transform: options.transform }),
      exposure: { startFrame: offset, endFrame },
    }),
    kind: "group" as const,
    children: copied.layers,
  };
  if (parent?.kind === "group") parent.children.push(instance);
  else animation.layers.push(instance);
  if (compositeSource?.kind === "source") compositeSource.layerIds.push(instance.id);
  if (copied.controllers?.length)
    animation.controllers = [...(animation.controllers ?? []), ...copied.controllers];
  if (copied.meshes?.length) animation.meshes = [...(animation.meshes ?? []), ...copied.meshes];
  return { animation: defineShotAnimation(animation), copied };
}
