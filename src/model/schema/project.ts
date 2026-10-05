import { projectSettingsSchema } from "./configuration.js";
import { studioSchema } from "./studio.js";
import { sequenceSchema, sceneSchema, boardShotSchema, panelSchema } from "./storyboard.js";
import { assetSchema } from "./media.js";
import { reviewCommentSchema, projectLockSchema, changeEntrySchema } from "./review.js";
import { z } from "zod";
import { brush } from "./brushes.js";
import { audioTrackSchema } from "./audio.js";
import { layer } from "./layers.js";

export const storyboardSchema = z.object({
  studio: studioSchema,
  components: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      version: z.number().int().positive(),
      layers: z.array(layer),
    }),
  ),
  schemaVersion: z.literal(5),
  version: z.number().int().nonnegative(),
  id: z.string().min(1),
  title: projectSettingsSchema.shape.title,
  author: projectSettingsSchema.shape.author,
  createdAt: z.string(),
  updatedAt: z.string(),
  canvas: projectSettingsSchema.shape.canvas,
  seed: projectSettingsSchema.shape.seed,
  frameRate: projectSettingsSchema.shape.frameRate,
  idCounter: z.number().int().nonnegative(),
  sequences: z.array(sequenceSchema),
  scenes: z.array(sceneSchema),
  shots: z.array(boardShotSchema),
  panels: z.array(panelSchema),
  brushes: z.array(brush),
  assets: z.array(assetSchema),
  audioTracks: z.array(audioTrackSchema),
  comments: z.array(reviewCommentSchema),
  locks: z.array(projectLockSchema),
  changes: z.array(changeEntrySchema),
  metadata: z.record(z.string(), z.string()),
});

export { projectChangesSchema } from "./configuration.js";
