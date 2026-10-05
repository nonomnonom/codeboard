import { z } from "zod";
import {
  exposureSchema,
  drawingSequenceSchema,
  twoBoneRigSchema,
  cameraKeyframeFieldsSchema,
  layerKeyframeFieldsSchema,
} from "../../../model/schema/animation.js";
import { id, frame } from "./common.js";

export const animationCommands = {
  "layer.exposure": z
    .object({ op: z.literal("layer.exposure"), id, exposure: exposureSchema })
    .strict(),
  "drawing.sequence": z
    .object({ op: z.literal("drawing.sequence"), id, keys: drawingSequenceSchema.nullable() })
    .strict(),
  "drawing.range": z
    .object({
      op: z.literal("drawing.range"),
      id,
      startFrame: z.number().int().nonnegative(),
      endFrame: z.number().int().positive(),
      drawingId: id.nullable(),
    })
    .strict(),
  "rig.define": z
    .object({ op: z.literal("rig.define"), id, definition: twoBoneRigSchema.nullable() })
    .strict(),
  "rig.pose": z
    .object({
      op: z.literal("rig.pose"),
      id,
      frame: z.number().int().nonnegative(),
      target: z.object({ x: z.number().finite(), y: z.number().finite() }).strict(),
      bend: z.union([z.literal(1), z.literal(-1)]).optional(),
      unreachable: z.enum(["reject", "clamp"]).optional(),
    })
    .strict(),
  "camera.key": z
    .object({
      op: z.literal("camera.key"),
      shotId: id,
      frame,
      value: cameraKeyframeFieldsSchema
        .omit({ id: true, frame: true, channelEasing: true })
        .partial()
        .strict(),
    })
    .strict(),
  "camera.key.update": z
    .object({
      op: z.literal("camera.key.update"),
      shotId: id,
      id,
      changes: cameraKeyframeFieldsSchema.omit({ id: true }).partial().strict(),
    })
    .strict(),
  "camera.key.remove": z.object({ op: z.literal("camera.key.remove"), shotId: id, id }).strict(),
  "camera.key.removeChannels": z
    .object({
      op: z.literal("camera.key.removeChannels"),
      shotId: id,
      id,
      channels: z.array(z.enum(["x", "y", "zoom", "rotation"])).min(1),
    })
    .strict(),
  "layer.key": z
    .object({
      op: z.literal("layer.key"),
      layerId: id,
      frame,
      value: layerKeyframeFieldsSchema
        .omit({ id: true, frame: true, channelEasing: true })
        .partial()
        .strict(),
    })
    .strict(),
  "layer.key.update": z
    .object({
      op: z.literal("layer.key.update"),
      layerId: id,
      id,
      changes: layerKeyframeFieldsSchema.omit({ id: true }).partial().strict(),
    })
    .strict(),
  "layer.key.remove": z.object({ op: z.literal("layer.key.remove"), layerId: id, id }).strict(),
  "layer.key.removeChannels": z
    .object({
      op: z.literal("layer.key.removeChannels"),
      layerId: id,
      id,
      channels: z
        .array(z.enum(["x", "y", "scaleX", "scaleY", "rotation", "opacity", "depth"]))
        .min(1),
    })
    .strict(),
};
