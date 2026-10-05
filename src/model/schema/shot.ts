import { z } from "zod";
import { shotCompositeGraphSchema } from "./compositing.js";
import { shotRetimeOptionsSchema } from "./shot-timing.js";
import { shotControllerSchema, shotControllerEdits } from "./controllers.js";
import {
  layerSkinSchema,
  skinInfluencesSchema,
  meshAnimationSchema,
  meshKeyframeSchema,
  curveMeshSchema,
  curveKeyframeSchema,
  envelopeMeshSchema,
  envelopeKeyframeSchema,
} from "./deformation.js";
import { studioAudioSchema } from "./studio-audio.js";
import { color } from "./primitives.js";
import { localLayer, layerChangesSchema, layerOptionsSchema } from "./layers.js";
import {
  localCameraKeyframeSchema,
  localLayerKeyframeSchema,
  localExposureSchema,
  localDrawingSequenceSchema,
  twoBoneRigSchema,
  easingSchema,
  rationalRateSchema as rate,
} from "./animation.js";

const id = z.string().min(1).max(4096);
const frame = z.number().int().nonnegative().safe();
const boardPanelIds = z
  .array(id)
  .max(4096)
  .refine((ids) => new Set(ids).size === ids.length, "Board panel links must be unique");
export const shotAnimationSchema = z
  .object({
    compositing: shotCompositeGraphSchema.optional(),
    controllers: z.array(shotControllerSchema).max(64).optional(),
    meshes: z
      .array(
        z.union([
          z.object({ layerId: id, skin: layerSkinSchema }).strict(),
          z.object({ layerId: id, mesh: meshAnimationSchema }).strict(),
          z.object({ layerId: id, curve: curveMeshSchema }).strict(),
          z.object({ layerId: id, envelope: envelopeMeshSchema }).strict(),
        ]),
      )
      .max(256)
      .optional(),
    boardPanelIds: boardPanelIds.optional(),
    audio: studioAudioSchema.optional(),
    id,
    shotId: id,
    name: z.string(),
    frameRate: rate,
    durationFrames: frame.positive(),
    canvas: z
      .object({
        width: frame.positive().max(8192),
        height: frame.positive().max(8192),
        background: color,
      })
      .strict(),
    layers: z.array(localLayer),
    cameraKeyframes: z.array(localCameraKeyframeSchema),
  })
  .strict();
export const shotAnimationEditsSchema = z
  .array(
    z.discriminatedUnion("op", [
      shotRetimeOptionsSchema.extend({ op: z.literal("timing.retime") }),
      z
        .object({ op: z.literal("compositing.set"), graph: shotCompositeGraphSchema.nullable() })
        .strict(),
      ...shotControllerEdits,
      z
        .object({
          op: z.literal("layer.skin.weights.put"),
          layerId: id,
          vertexIndex: z.number().int().nonnegative().max(12287),
          influences: skinInfluencesSchema,
        })
        .strict(),
      z
        .object({
          op: z.literal("layer.skin.bind.capture"),
          layerId: id,
          frame: z.number().int().safe(),
        })
        .strict(),
      z
        .object({ op: z.literal("layer.skin"), layerId: id, skin: layerSkinSchema.nullable() })
        .strict(),
      z
        .object({
          op: z.literal("layer.deformation.rest.apply"),
          layerId: id,
          frame: z.number().int().safe(),
          easing: easingSchema.optional(),
        })
        .strict(),
      z
        .object({
          op: z.literal("layer.envelope"),
          layerId: id,
          envelope: envelopeMeshSchema.nullable(),
        })
        .strict(),
      z
        .object({
          op: z.literal("layer.envelope.key.put"),
          layerId: id,
          key: envelopeKeyframeSchema,
        })
        .strict(),
      z
        .object({
          op: z.literal("layer.envelope.key.remove"),
          layerId: id,
          frame: z.number().int().safe(),
        })
        .strict(),
      z
        .object({ op: z.literal("layer.curve.key.put"), layerId: id, key: curveKeyframeSchema })
        .strict(),
      z
        .object({
          op: z.literal("layer.curve.key.remove"),
          layerId: id,
          frame: z.number().int().safe(),
        })
        .strict(),
      z
        .object({ op: z.literal("layer.curve"), layerId: id, curve: curveMeshSchema.nullable() })
        .strict(),
      z
        .object({ op: z.literal("layer.mesh.key.put"), layerId: id, key: meshKeyframeSchema })
        .strict(),
      z
        .object({
          op: z.literal("layer.mesh.key.remove"),
          layerId: id,
          frame: z.number().int().safe(),
        })
        .strict(),
      z
        .object({ op: z.literal("layer.mesh"), layerId: id, mesh: meshAnimationSchema.nullable() })
        .strict(),
      z
        .object({
          op: z.literal("layer.drawing.range"),
          layerId: id,
          startFrame: z.number().int().safe(),
          endFrame: z.number().int().safe(),
          drawingId: id.nullable(),
        })
        .strict(),
      z.object({ op: z.literal("board.link"), panelIds: boardPanelIds }).strict(),
      z
        .object({
          op: z.literal("layer.pose"),
          layerId: id,
          frame: z.number().int().safe(),
          keyId: id,
          mode: z.enum(["replace", "additive"]),
          weight: z.number().finite().min(0).max(1),
          values: z
            .object({
              x: z.number().finite().optional(),
              y: z.number().finite().optional(),
              scaleX: z.number().finite().optional(),
              scaleY: z.number().finite().optional(),
              rotation: z.number().finite().optional(),
              opacity: z.number().finite().optional(),
              depth: z.number().finite().optional(),
            })
            .strict()
            .refine(
              (values) => Object.values(values).some((value) => value !== undefined),
              "Pose must author at least one channel",
            ),
          easing: easingSchema.optional(),
        })
        .strict(),
      z
        .object({
          op: z.literal("layer.rig.rest.capture"),
          layerId: id,
          frame: z.number().int().safe(),
        })
        .strict(),
      z
        .object({
          op: z.literal("layer.rig.rest.apply"),
          layerId: id,
          frame: z.number().int().safe(),
          rootKeyId: id,
          elbowKeyId: id,
          easing: easingSchema.optional(),
        })
        .strict(),
      z
        .object({
          op: z.literal("layer.rig.pose"),
          layerId: id,
          frame: z.number().int().safe(),
          target: z.object({ x: z.number().finite(), y: z.number().finite() }).strict(),
          rootKeyId: id,
          elbowKeyId: id,
          unreachable: z.enum(["reject", "clamp"]),
          bend: z.union([z.literal(1), z.literal(-1)]).optional(),
          easing: easingSchema.optional(),
        })
        .strict(),
      z
        .object({
          op: z.literal("layer.add"),
          id,
          kind: z.enum(["raster", "vector", "group"]),
          name: z.string(),
          options: layerOptionsSchema
            .omit({ id: true })
            .extend({ exposure: localExposureSchema.unwrap().optional() })
            .optional(),
          parentId: id.optional(),
          beforeId: id.optional(),
        })
        .strict(),
      z
        .object({
          op: z.literal("layer.move"),
          layerId: id,
          parentId: id.nullable(),
          beforeId: id.optional(),
        })
        .strict(),
      z.object({ op: z.literal("layer.remove"), layerId: id }).strict(),
      z
        .object({
          op: z.literal("layer.rig"),
          layerId: id,
          definition: twoBoneRigSchema.nullable(),
        })
        .strict(),
      z
        .object({
          op: z.literal("layer.depth"),
          layerId: id,
          depth: z.number().finite().positive(),
        })
        .strict(),
      z.object({ op: z.literal("layer.set"), layerId: id, changes: layerChangesSchema }).strict(),
      z
        .object({ op: z.literal("layer.exposure"), layerId: id, exposure: localExposureSchema })
        .strict(),
      z
        .object({
          op: z.literal("layer.drawings"),
          layerId: id,
          keys: localDrawingSequenceSchema.nullable(),
        })
        .strict(),
      z
        .object({ op: z.literal("layer.key.put"), layerId: id, key: localLayerKeyframeSchema })
        .strict(),
      z.object({ op: z.literal("layer.key.remove"), layerId: id, id }).strict(),
      z.object({ op: z.literal("camera.key.put"), key: localCameraKeyframeSchema }).strict(),
      z.object({ op: z.literal("camera.key.remove"), id }).strict(),
    ]),
  )
  .min(1)
  .max(1000);
