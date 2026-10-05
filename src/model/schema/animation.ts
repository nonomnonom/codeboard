import { normalizeRate } from "../../animation/rational-time.js";
import { z } from "zod";
import type { LayerKeyframe, CameraKeyframe, LayerEffectValue } from "../types.js";
import { unitInterval, transform, finite } from "./primitives.js";

export const easingSchema = z.union([
  z.enum(["linear", "ease-in-out", "hold"]),
  z
    .object({
      type: z.literal("cubic-bezier"),
      x1: unitInterval,
      y1: unitInterval,
      x2: unitInterval,
      y2: unitInterval,
    })
    .strict(),
]);

export const effectValuesSchema = z
  .array(
    z
      .object({
        index: z.number().int().min(0).max(15),
        channel: z.enum(["offsetX", "offsetY", "opacity"]).optional(),
        value: finite.min(-4096).max(4096),
        easing: easingSchema.optional(),
      })
      .strict(),
  )
  .max(64)
  .refine(
    (values) =>
      new Set(values.map((entry) => `${entry.index}:${entry.channel ?? "value"}`)).size ===
      values.length,
    "Effect key index/channel pairs must be unique",
  )
  .transform((values) =>
    values.map(
      ({ index, channel, value, easing }): LayerEffectValue => ({
        index,
        value,
        ...(channel === undefined ? {} : { channel }),
        ...(easing === undefined ? {} : { easing }),
      }),
    ),
  );

export const layerKeyframeFieldsSchema = z.object({
  effectValues: effectValuesSchema.optional(),
  id: z.string(),
  frame: z.number().int().nonnegative(),
  transform: transform.partial().strict(),
  opacity: finite.min(0).max(1).optional(),
  depth: finite.positive().optional(),
  easing: easingSchema,
  channelEasing: z
    .object(
      Object.fromEntries(
        ["x", "y", "scaleX", "scaleY", "rotation", "opacity", "depth"].map((key) => [
          key,
          easingSchema.optional(),
        ]),
      ),
    )
    .strict()
    .optional(),
});

function layerKeyframe(fields: typeof layerKeyframeFieldsSchema) {
  return fields
    .superRefine((key, ctx) => {
      if (
        key.opacity === undefined &&
        key.depth === undefined &&
        !key.effectValues?.length &&
        !Object.values(key.transform).some((value) => value !== undefined)
      )
        ctx.addIssue({
          code: "custom",
          message: "Layer keyframe must author at least one property",
        });
      for (const [channel, easing] of Object.entries(key.channelEasing ?? {}))
        if (
          easing !== undefined &&
          (channel === "opacity" || channel === "depth"
            ? key[channel]
            : key.transform[channel as keyof typeof key.transform]) === undefined
        )
          ctx.addIssue({ code: "custom", message: `Easing requires a keyed property: ${channel}` });
    })
    .transform(
      (key): LayerKeyframe => ({
        id: key.id,
        frame: key.frame,
        easing: key.easing,
        transform: Object.fromEntries(
          Object.entries(key.transform).filter(([, value]) => value !== undefined),
        ),
        ...(key.effectValues === undefined
          ? {}
          : {
              effectValues: key.effectValues,
            }),
        ...(key.opacity === undefined ? {} : { opacity: key.opacity }),
        ...(key.depth === undefined ? {} : { depth: key.depth }),
        ...(key.channelEasing
          ? {
              channelEasing: Object.fromEntries(
                Object.entries(key.channelEasing).filter(([, value]) => value !== undefined),
              ),
            }
          : {}),
      }),
    );
}

export const layerKeyframeSchema = layerKeyframe(layerKeyframeFieldsSchema);
export const localLayerKeyframeSchema = layerKeyframe(
  layerKeyframeFieldsSchema.extend({ frame: z.number().int().safe() }),
);

export const cameraChannels = ["x", "y", "zoom", "rotation"] as const;

export const cameraKeyframeFieldsSchema = z
  .object({
    id: z.string(),
    frame: z.number().int().nonnegative(),
    x: finite.optional(),
    y: finite.optional(),
    zoom: finite.positive().optional(),
    rotation: finite.optional(),
    easing: easingSchema,
    channelEasing: z
      .object({
        x: easingSchema.optional(),
        y: easingSchema.optional(),
        zoom: easingSchema.optional(),
        rotation: easingSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

function cameraKeyframe(fields: typeof cameraKeyframeFieldsSchema) {
  return fields
    .superRefine((key, ctx) => {
      if (!cameraChannels.some((channel) => key[channel] !== undefined))
        ctx.addIssue({
          code: "custom",
          message: "Camera keyframe must author at least one property",
        });
      for (const channel of cameraChannels)
        if (key.channelEasing?.[channel] !== undefined && key[channel] === undefined)
          ctx.addIssue({ code: "custom", message: `Easing requires a keyed property: ${channel}` });
    })
    .transform(
      (key): CameraKeyframe => ({
        id: key.id,
        frame: key.frame,
        easing: key.easing,
        ...Object.fromEntries(
          cameraChannels
            .filter((channel) => key[channel] !== undefined)
            .map((channel) => [channel, key[channel]]),
        ),
        ...(key.channelEasing
          ? {
              channelEasing: Object.fromEntries(
                Object.entries(key.channelEasing).filter(([, value]) => value !== undefined),
              ),
            }
          : {}),
      }),
    );
}

export const cameraKeyframeSchema = cameraKeyframe(cameraKeyframeFieldsSchema);
export const localCameraKeyframeSchema = cameraKeyframe(
  cameraKeyframeFieldsSchema.extend({ frame: z.number().int().safe() }),
);

export const exposureSchema = z
  .object({
    startFrame: z.number().int().nonnegative(),
    endFrame: z.number().int().positive(),
  })
  .refine((value) => value.endFrame > value.startFrame, {
    message: "Exposure end must follow start",
    path: ["endFrame"],
  })
  .nullable();

export const transitionSchema = z.object({
  type: z.enum(["cut", "dissolve", "wipe-left", "wipe-right"]),
  durationFrames: z.number().int().nonnegative(),
});

export const drawingSequenceSchema = z
  .array(
    z
      .object({ frame: z.number().int().nonnegative(), drawingId: z.string().min(1).nullable() })
      .strict(),
  )
  .refine(
    (keys) => keys.every((key, i) => i === 0 || key.frame > keys[i - 1]!.frame),
    "Drawing exposure frames must be unique and increasing",
  );

export const twoBoneRigSchema = z
  .object({
    elbowId: z.string().min(1),
    upperLength: finite.positive(),
    lowerLength: finite.positive(),
    restPose: z
      .object({
        root: z.object({ x: finite, y: finite, rotation: finite }).strict(),
        elbowRotation: finite,
      })
      .strict()
      .optional(),
  })
  .strict();

export const localExposureSchema = z
  .object({ startFrame: z.number().int().safe(), endFrame: z.number().int().safe() })
  .refine((value) => value.endFrame > value.startFrame, {
    message: "Exposure end must follow start",
    path: ["endFrame"],
  })
  .nullable();
export const localDrawingSequenceSchema = z
  .array(drawingSequenceSchema.element.extend({ frame: z.number().int().safe() }))
  .refine(
    (keys) => keys.every((key, i) => i === 0 || key.frame > keys[i - 1]!.frame),
    "Drawing exposure frames must be unique and increasing",
  );

export const rationalRateSchema = z
  .object({
    numerator: z.number().int().positive().safe(),
    denominator: z.number().int().positive().safe(),
  })
  .strict()
  .transform(normalizeRate);
