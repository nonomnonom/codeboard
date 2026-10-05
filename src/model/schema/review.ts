import { z } from "zod";
import { finite } from "./primitives.js";

export const reviewCommentSchema = z.object({
  id: z.string(),
  author: z.string(),
  body: z.string(),
  status: z.enum(["open", "resolved"]),
  anchor: z.object({
    panelId: z.string().optional(),
    layerId: z.string().optional(),
    elementId: z.string().optional(),
    frame: z.number().int().nonnegative().optional(),
    x: finite.optional(),
    y: finite.optional(),
  }),
  createdAt: z.string(),
  resolvedAt: z.string().optional(),
});

export const projectLockSchema = z.object({
  id: z.string(),
  targetType: z.enum(["project", "panel", "layer"]),
  targetId: z.string(),
  owner: z.string(),
  reason: z.string(),
  createdAt: z.string(),
});

export const changeEntrySchema = z.object({
  id: z.string(),
  version: z.number().int().nonnegative(),
  actor: z.string(),
  operation: z.string(),
  targetIds: z.array(z.string()),
  timestamp: z.string(),
});
