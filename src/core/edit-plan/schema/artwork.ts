import { z } from "zod";
import { layerChangesSchema, layerOptionsSchema } from "../../../model/schema/layers.js";
import { pathCommandSchema } from "../../../model/schema/artwork.js";
import { brush } from "../../../model/schema/brushes.js";
import { planElementSchema } from "../artwork.js";
import { planComponentSourceSchema } from "../component-source.js";
import { id, pixelRegion } from "./common.js";
import {
  paletteSchema,
  colorBindingSchema,
  colorChannelSchema,
} from "../../../model/schema/palettes.js";

export const artworkCommands = {
  "component.source.replace": z
    .object({
      op: z.literal("component.source.replace"),
      componentId: id,
      layers: planComponentSourceSchema,
      expectedComponentVersion: z.number().int().positive().safe(),
    })
    .strict(),
  "component.upgrade": z
    .object({
      op: z.literal("component.upgrade"),
      id,
      expectedInputHash: z.string().regex(/^[a-f0-9]{64}$/),
      newIdentities: z
        .array(z.object({ sourceId: id, copyId: id }).strict())
        .max(100000)
        .optional(),
      resolutions: z.record(z.string().max(16384), z.enum(["local", "incoming"])).optional(),
    })
    .strict(),
  "component.element.replace": z
    .object({
      op: z.literal("component.element.replace"),
      componentId: id,
      layerId: id,
      element: planElementSchema,
      expectedComponentVersion: z.number().int().positive().safe(),
    })
    .strict(),
  "palette.put": z.object({ op: z.literal("palette.put"), palette: paletteSchema }).strict(),
  "palette.remove": z.object({ op: z.literal("palette.remove"), id }).strict(),
  "palette.bind": z
    .object({
      op: z.literal("palette.bind"),
      elementId: id,
      channel: colorChannelSchema,
      binding: colorBindingSchema.nullable(),
    })
    .strict(),
  "layer.set": z
    .object({ op: z.literal("layer.set"), panelId: id, id, changes: layerChangesSchema })
    .strict(),
  "layer.depth": z
    .object({ op: z.literal("layer.depth"), id, depth: z.number().finite().positive() })
    .strict(),
  "layer.add": z
    .object({
      op: z.literal("layer.add"),
      panelId: id,
      kind: z.enum(["raster", "vector", "group"]),
      name: z.string(),
      options: layerOptionsSchema.extend({ id }),
      parentId: id.optional(),
    })
    .strict(),
  "layer.move": z.object({ op: z.literal("layer.move"), id, beforeId: id.optional() }).strict(),
  "layer.reparent": z
    .object({
      op: z.literal("layer.reparent"),
      id,
      parentId: id.nullable(),
      beforeId: id.optional(),
    })
    .strict(),
  "layer.remove": z.object({ op: z.literal("layer.remove"), id }).strict(),
  "element.add": z
    .object({ op: z.literal("element.add"), panelId: id, layerId: id, element: planElementSchema })
    .strict(),
  "element.replace": z
    .object({
      op: z.literal("element.replace"),
      panelId: id,
      layerId: id,
      id,
      element: planElementSchema,
    })
    .strict(),
  "element.remove": z
    .object({ op: z.literal("element.remove"), panelId: id, layerId: id, ids: z.array(id).min(1) })
    .strict(),
  "element.outline": z
    .object({ op: z.literal("element.outline"), panelId: id, layerId: id, id })
    .strict(),
  "element.boolean": z
    .object({
      op: z.literal("element.boolean"),
      panelId: id,
      layerId: id,
      id,
      tool: z.array(pathCommandSchema),
      operation: z.enum(["union", "intersect", "difference", "xor"]),
    })
    .strict(),
  "pixels.patch": z
    .object({
      op: z.literal("pixels.patch"),
      panelId: id,
      layerId: id,
      id,
      region: pixelRegion,
      pixelsBase64: z.string(),
    })
    .strict(),
  "brush.create": z
    .object({
      op: z.literal("brush.create"),
      definition: brush.omit({ version: true }).extend({ id }).strict(),
    })
    .strict(),
  "brush.revise": z
    .object({
      op: z.literal("brush.revise"),
      id,
      changes: brush.omit({ id: true, version: true }).partial().strict(),
    })
    .strict(),
  "brush.duplicate": z
    .object({ op: z.literal("brush.duplicate"), id, name: z.string().min(1) })
    .strict(),
  "component.capture": z
    .object({ op: z.literal("component.capture"), layerId: id, id, name: z.string() })
    .strict(),
  "component.revise": z
    .object({ op: z.literal("component.revise"), id, sourceLayerId: id })
    .strict(),
  "component.instantiate": z
    .object({
      op: z.literal("component.instantiate"),
      id,
      componentId: id,
      panelId: id,
      transform: layerOptionsSchema.shape.transform,
    })
    .strict(),
  "component.refresh": z
    .object({
      op: z.literal("component.refresh"),
      id,
      comments: z.enum(["reject", "anchor-to-instance"]),
    })
    .strict(),
};
