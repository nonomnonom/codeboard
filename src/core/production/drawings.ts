import { copyComponentOrigins } from "../../model/component-origins.js";
import { replaceDrawingRange } from "../../animation/drawing-range.js";
import { assertRenderFrame } from "../../animation/frame.js";
import type {
  Id,
  Layer,
  DrawingExposure,
  DrawingNeighbors,
  PageOptions,
} from "../../model/types.js";
import { exposureSchema, drawingSequenceSchema } from "../../model/schema/animation.js";
import { validateDrawingSequence } from "../../model/validation/artwork.js";
import type { ProductionHost, MutationOptions } from "./host.js";
import { findLayer, cloneLayersWithIdentities } from "../../model/layers.js";

type Host = Pick<
  ProductionHost,
  | "_applyProduction"
  | "_readDrawingNeighbors"
  | "_readDrawingSequence"
  | "_readDrawingExposures"
  | "_readDrawingAlternatives"
>;

export function drawingSequence(host: Host, groupId: Id) {
  return host._readDrawingSequence(groupId);
}

export function drawingExposures(host: Host, groupId: Id, options: PageOptions = {}) {
  return host._readDrawingExposures(groupId, options);
}

export function drawingAlternatives(host: Host, groupId: Id, options: PageOptions = {}) {
  return host._readDrawingAlternatives(groupId, options);
}

export function drawingNeighbors(
  host: Host,
  groupId: Id,
  frame: number,
  options: { skipBlank?: boolean } = {},
): DrawingNeighbors {
  return host._readDrawingNeighbors(groupId, frame, options.skipBlank ?? true);
}

export function setDrawingSequence(
  host: Host,
  groupId: Id,
  keys: readonly DrawingExposure[] | null,
  options: MutationOptions = {},
) {
  const proposed = keys === null ? null : drawingSequenceSchema.parse(keys);
  host._applyProduction(
    "set drawing sequence",
    [groupId],
    options.expectedVersion,
    (d) => {
      const { layer, panel } = findLayer(d, groupId);
      if (layer.kind !== "group") throw new Error(`Drawing sequence requires a group: ${groupId}`);
      if (proposed !== null) validateDrawingSequence({ ...layer, drawingSequence: proposed });
      if (proposed === null) delete layer.drawingSequence;
      else layer.drawingSequence = proposed;
      panel.revision++;
    },
    { layerId: groupId },
  );
}

export function duplicateDrawing(
  host: Host,
  groupId: Id,
  drawingId: Id,
  name: string,
  options: MutationOptions = {},
): Id {
  let id = "";
  host._applyProduction(
    "duplicate drawing for local variation",
    [groupId, drawingId],
    options.expectedVersion,
    (d, next) => {
      const { layer } = findLayer(d, groupId);
      if (layer.kind !== "group" || layer.drawingSequence === undefined)
        throw new Error(`Layer is not a drawing sequence: ${groupId}`);
      const source = layer.children.find((child) => child.id === drawingId);
      if (!source) throw new Error(`Drawing ${drawingId} is not a child of ${groupId}`);
      const copied = cloneLayersWithIdentities([source], next);
      const drawing = copied.layers[0]!;
      drawing.name = name;
      id = drawing.id;
      layer.children.push(drawing);
      copyComponentOrigins(d, copied, next);
    },
    { layerId: groupId },
  );
  return id;
}

export function setDrawingRange(
  host: Host,
  groupId: Id,
  startFrame: number,
  endFrame: number,
  drawingId: Id | null,
  options: MutationOptions = {},
): void {
  assertRenderFrame(startFrame);
  assertRenderFrame(endFrame);
  if (endFrame <= startFrame)
    throw new Error("Drawing range end must follow start (end is exclusive)");
  host._applyProduction(
    "replace drawing exposure range",
    [groupId],
    options.expectedVersion,
    (d) => {
      const { layer, panel } = findLayer(d, groupId);
      if (layer.kind !== "group" || layer.drawingSequence === undefined)
        throw new Error(`Layer is not a drawing sequence: ${groupId}`);
      const proposed = drawingSequenceSchema.parse(
        replaceDrawingRange(layer.drawingSequence, startFrame, endFrame, drawingId),
      );
      validateDrawingSequence({ ...layer, drawingSequence: proposed });
      layer.drawingSequence = proposed;
      panel.revision++;
    },
    { layerId: groupId },
  );
}

export function setExposure(
  host: Host,
  layerId: Id,
  exposure: Layer["exposure"],
  options: MutationOptions = {},
) {
  host._applyProduction(
    "set drawing exposure",
    [layerId],
    options.expectedVersion,
    (d) => {
      const proposed = exposureSchema.parse(exposure);
      findLayer(d, layerId).layer.exposure = proposed;
    },
    { layerId },
  );
}
