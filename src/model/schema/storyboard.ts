import { z } from "zod";
import { finite, color, point } from "./primitives.js";
import { cameraKeyframeSchema, transitionSchema } from "./animation.js";
import { layer } from "./layers.js";

export const sequenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  sceneIds: z.array(z.string()),
});

export const sceneSchema = z.object({
  id: z.string(),
  sequenceId: z.string(),
  name: z.string(),
  shotIds: z.array(z.string()),
});

export const boardShotSchema = z.object({
  id: z.string(),
  sceneId: z.string(),
  name: z.string(),
  panelIds: z.array(z.string()),
  cameraKeyframes: z.array(cameraKeyframeSchema),
});

export const panelSchema = z.object({
  id: z.string(),
  shotId: z.string(),
  number: z.string(),
  title: z.string(),
  width: finite.positive(),
  height: finite.positive(),
  durationFrames: z.number().int().positive(),
  startFrame: z.number().int().nonnegative(),
  transition: transitionSchema,
  status: z.enum(["working", "review", "approved"]),
  action: z.string(),
  dialogue: z.string(),
  camera: z.string(),
  notes: z.string(),
  layers: z.array(layer),
  motion: z.array(z.object({ id: z.string(), label: z.string(), from: point, to: point, color })),
  revision: z.number().int().nonnegative(),
});
