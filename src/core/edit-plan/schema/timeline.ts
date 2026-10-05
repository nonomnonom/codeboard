import { z } from "zod";
import { projectChangesSchema } from "../../../model/schema/configuration.js";
import { transitionSchema } from "../../../model/schema/animation.js";
import { id } from "./common.js";
import { panelSchema as panel } from "../../../model/schema/storyboard.js";
import { scriptInputSchema } from "../../../model/schema/script.js";

export const timelineCommands = {
  "script.replace": z
    .object({
      op: z.literal("script.replace"),
      script: scriptInputSchema,
      expectedRevision: z.number().int().nonnegative().safe(),
    })
    .strict(),
  "project.configure": z
    .object({ op: z.literal("project.configure"), changes: projectChangesSchema })
    .strict(),
  "project.metadata": z
    .object({ op: z.literal("project.metadata"), key: z.string(), value: z.string() })
    .strict(),
  "panel.revise": z
    .object({
      op: z.literal("panel.revise"),
      id,
      changes: panel
        .pick({
          title: true,
          durationFrames: true,
          action: true,
          dialogue: true,
          camera: true,
          notes: true,
        })
        .partial()
        .strict(),
    })
    .strict(),
  "panel.status": z
    .object({ op: z.literal("panel.status"), id, status: panel.shape.status })
    .strict(),
  "sequence.add": z.object({ op: z.literal("sequence.add"), id, name: z.string() }).strict(),
  "scene.add": z
    .object({ op: z.literal("scene.add"), sequenceId: id, id, name: z.string() })
    .strict(),
  "shot.add": z.object({ op: z.literal("shot.add"), sceneId: id, id, name: z.string() }).strict(),
  "panel.add": z
    .object({
      op: z.literal("panel.add"),
      shotId: id,
      options: panel
        .pick({
          number: true,
          title: true,
          width: true,
          height: true,
          durationFrames: true,
          action: true,
          dialogue: true,
          camera: true,
          notes: true,
        })
        .partial()
        .extend({ id })
        .strict(),
    })
    .strict(),
  "panel.duration": z
    .object({
      op: z.literal("panel.duration"),
      id,
      durationFrames: z.number().int().positive(),
      mode: z.enum(["ripple", "preserve"]),
    })
    .strict(),
  "panel.transition": z
    .object({ op: z.literal("panel.transition"), id, transition: transitionSchema.strict() })
    .strict(),
  "panel.number": z.object({ op: z.literal("panel.number"), id, number: z.string() }).strict(),
  "panel.move": z.object({ op: z.literal("panel.move"), id, beforeId: id.optional() }).strict(),
  "panel.duplicate": z.object({ op: z.literal("panel.duplicate"), id }).strict(),
  "panel.remove": z.object({ op: z.literal("panel.remove"), id }).strict(),
};
