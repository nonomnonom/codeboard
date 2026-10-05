import { z } from "zod";
import { controllerRangeSchema } from "../model/schema/controllers.js";
import type { ShotAnimation, ShotAnimationEdit } from "../model/types/shot.js";
import { CodeboardError } from "../model/errors.js";
import { allLayers } from "../model/layers.js";
import { defineShotAnimation } from "./shot.js";
import { reviseShotAnimation } from "./shot-edit.js";
import { normalizeRate } from "./rational-time.js";

export interface ControllerTransferOptions {
  controllers: readonly { sourceId: string; targetId: string }[];
  layers: readonly { sourceId: string; targetId: string }[];
  frameOffset: number;
  sourceRange?: { startFrame: number; endFrame: number };
}
const id = z.string().min(1).max(4096);
const mapping = z.object({ sourceId: id, targetId: id }).strict();
const optionsSchema = z
  .object({
    controllers: z.array(mapping).min(1).max(64),
    layers: z.array(mapping).min(1).max(16384),
    frameOffset: z.number().int().safe(),
    sourceRange: controllerRangeSchema.optional(),
  })
  .strict();

/** Prepare new controller definitions; preserve destination base animation and existing controllers. */
export function compileControllerTransfer(
  sourceInput: ShotAnimation,
  targetInput: ShotAnimation,
  input: ControllerTransferOptions,
): ShotAnimationEdit[] {
  return compileControllerDefinitions(defineShotAnimation(sourceInput), targetInput, input);
}

/** Internal transfer owner; callers validate the source definitions at their trust boundary. */
export function compileControllerDefinitions(
  source: Pick<ShotAnimation, "controllers" | "frameRate">,
  targetInput: ShotAnimation,
  input: ControllerTransferOptions,
): ShotAnimationEdit[] {
  const parsed = optionsSchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid controller transfer", {
      details: { reason: "CONTROLLER_TRANSFER_INPUT", issues: parsed.error.issues },
    });
  const target = defineShotAnimation(targetInput);
  const sourceRate = normalizeRate(source.frameRate),
    targetRate = normalizeRate(target.frameRate);
  if (
    sourceRate.numerator !== targetRate.numerator ||
    sourceRate.denominator !== targetRate.denominator
  )
    throw new CodeboardError("INVALID_ARGUMENT", "Controller transfer requires equal frame rates", {
      details: { reason: "CONTROLLER_TRANSFER_RATE", sourceRate, targetRate },
    });
  const options = parsed.data;
  const shift = (position: number): number => {
    const shifted = Number(BigInt(position) + BigInt(options.frameOffset));
    if (!Number.isSafeInteger(shifted))
      throw new CodeboardError(
        "RESOURCE_LIMIT",
        "Transferred controller frame exceeds safe integer range",
      );
    return shifted;
  };
  const uniqueMap = (entries: typeof options.layers, kind: string) => {
    const result = new Map<string, string>(),
      destinations = new Set<string>();
    for (const entry of entries) {
      if (result.has(entry.sourceId) || destinations.has(entry.targetId))
        throw new CodeboardError("INVALID_ARGUMENT", "Transfer mappings must be one-to-one", {
          details: { reason: "CONTROLLER_TRANSFER_MAPPING", kind, ...entry },
        });
      result.set(entry.sourceId, entry.targetId);
      destinations.add(entry.targetId);
    }
    return result;
  };
  const controllerMap = uniqueMap(options.controllers, "controllers");
  const layerMap = uniqueMap(options.layers, "layers");
  const targetLayers = new Set(allLayers(target.layers).map((layer) => layer.id));
  const existing = new Set(target.controllers?.map((controller) => controller.id));
  const usedLayers = new Set<string>();
  const edits: ShotAnimationEdit[] = [];
  for (const [sourceId, targetId] of controllerMap) {
    const controller = source.controllers?.find((entry) => entry.id === sourceId);
    if (!controller || existing.has(targetId))
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Transfer requires an existing source and a new destination controller",
        {
          details: { reason: "CONTROLLER_TRANSFER_ID", sourceId, targetId },
        },
      );
    const existingRange = controller.activeRange;
    const selected = options.sourceRange;
    const range =
      existingRange && selected
        ? {
            startFrame: Math.max(existingRange.startFrame, selected.startFrame),
            endFrame: Math.min(existingRange.endFrame, selected.endFrame),
          }
        : (selected ?? existingRange);
    if (range && range.endFrame <= range.startFrame)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Selected range does not overlap controller activity",
        {
          details: { reason: "CONTROLLER_TRANSFER_EMPTY_RANGE", controllerId: sourceId },
        },
      );
    edits.push({
      op: "controller.put",
      controller: {
        ...structuredClone(controller),
        id: targetId,
        ...(range
          ? {
              activeRange: { startFrame: shift(range.startFrame), endFrame: shift(range.endFrame) },
            }
          : {}),
        targets: controller.targets.map((entry) => {
          const layerId = layerMap.get(entry.layerId);
          if (!layerId || !targetLayers.has(layerId))
            throw new CodeboardError(
              "INVALID_ARGUMENT",
              "Transfer requires a mapping to an existing target layer",
              {
                details: {
                  reason: "CONTROLLER_TRANSFER_LAYER",
                  controllerId: sourceId,
                  layerId: entry.layerId,
                },
              },
            );
          usedLayers.add(entry.layerId);
          return { layerId, values: structuredClone(entry.values) };
        }),
        keyframes: controller.keyframes.map((key) => {
          const frame = shift(key.frame);
          return { ...structuredClone(key), frame };
        }),
      },
    });
  }
  if (usedLayers.size !== layerMap.size)
    throw new CodeboardError("INVALID_ARGUMENT", "Transfer contains unused layer mappings", {
      details: { reason: "CONTROLLER_TRANSFER_UNUSED_MAPPING" },
    });
  // The ordinary shot owner checks global IDs, final controller limits and target references.
  reviseShotAnimation(target, edits);
  return edits;
}
