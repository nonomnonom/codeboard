import { z } from "zod";
import { reviewCommentSchema, projectLockSchema } from "../../../model/schema/review.js";
import { id } from "./common.js";

export const collaborationCommands = {
  "review.comment": z
    .object({
      op: z.literal("review.comment"),
      body: z.string(),
      anchor: reviewCommentSchema.shape.anchor.strict(),
    })
    .strict(),
  "review.resolve": z.object({ op: z.literal("review.resolve"), id }).strict(),
  "lock.acquire": z
    .object({
      op: z.literal("lock.acquire"),
      targetType: projectLockSchema.shape.targetType,
      targetId: id,
      reason: z.string(),
    })
    .strict(),
  "lock.release": z.object({ op: z.literal("lock.release"), id }).strict(),
};
