import { z } from "zod";
import { CodeboardError } from "../../model/errors.js";
import type { EditPlan } from "./types.js";
import { fingerprint } from "./fingerprint.js";
import { id, hash } from "./schema/common.js";
import { studioCommands } from "./schema/studio.js";
import { timelineCommands } from "./schema/timeline.js";
import { artworkCommands } from "./schema/artwork.js";
import { animationCommands } from "./schema/animation.js";
import { mediaCommands } from "./schema/media.js";
import { collaborationCommands } from "./schema/collaboration.js";

export const commandSchema = z.discriminatedUnion("op", [
  studioCommands["character.instantiate"],
  artworkCommands["palette.put"],
  artworkCommands["palette.remove"],
  artworkCommands["palette.bind"],
  studioCommands["animation.element.add"],
  studioCommands["animation.element.remove"],
  studioCommands["animation.edit"],
  studioCommands["studio.audio.edit"],
  studioCommands["studio.audio.set"],
  studioCommands["editorial.edit"],
  studioCommands["animation.capturePanel"],
  studioCommands["animation.duplicate"],
  studioCommands["animation.element.replace"],
  studioCommands["animation.pixels.patch"],
  studioCommands["animation.put"],
  studioCommands["animation.remove"],
  studioCommands["editorial.put"],
  studioCommands["editorial.remove"],
  timelineCommands["project.configure"],
  timelineCommands["project.metadata"],
  timelineCommands["script.replace"],
  timelineCommands["panel.revise"],
  timelineCommands["panel.status"],
  artworkCommands["layer.set"],
  animationCommands["layer.exposure"],
  artworkCommands["layer.depth"],
  animationCommands["drawing.sequence"],
  animationCommands["drawing.range"],
  animationCommands["rig.define"],
  animationCommands["rig.pose"],
  animationCommands["camera.key"],
  animationCommands["camera.key.update"],
  animationCommands["camera.key.remove"],
  animationCommands["camera.key.removeChannels"],
  animationCommands["layer.key"],
  animationCommands["layer.key.update"],
  animationCommands["layer.key.remove"],
  animationCommands["layer.key.removeChannels"],
  mediaCommands["audio.track.add"],
  mediaCommands["audio.track.update"],
  mediaCommands["audio.track.remove"],
  mediaCommands["audio.clip.add"],
  mediaCommands["audio.clip.update"],
  mediaCommands["audio.clip.remove"],
  mediaCommands["audio.clip.move"],
  mediaCommands["audio.clip.split"],
  mediaCommands["asset.add"],
  mediaCommands["asset.update"],
  timelineCommands["sequence.add"],
  timelineCommands["scene.add"],
  timelineCommands["shot.add"],
  timelineCommands["panel.add"],
  timelineCommands["panel.duration"],
  timelineCommands["panel.transition"],
  timelineCommands["panel.number"],
  timelineCommands["panel.move"],
  timelineCommands["panel.duplicate"],
  timelineCommands["panel.remove"],
  artworkCommands["layer.add"],
  artworkCommands["layer.move"],
  artworkCommands["layer.reparent"],
  artworkCommands["layer.remove"],
  artworkCommands["element.add"],
  artworkCommands["element.replace"],
  artworkCommands["element.remove"],
  artworkCommands["element.outline"],
  artworkCommands["element.boolean"],
  artworkCommands["pixels.patch"],
  artworkCommands["brush.create"],
  artworkCommands["brush.revise"],
  artworkCommands["brush.duplicate"],
  artworkCommands["component.capture"],
  artworkCommands["component.revise"],
  artworkCommands["component.upgrade"],
  artworkCommands["component.source.replace"],
  artworkCommands["component.element.replace"],
  artworkCommands["component.instantiate"],
  artworkCommands["component.refresh"],
  collaborationCommands["review.comment"],
  collaborationCommands["review.resolve"],
  collaborationCommands["lock.acquire"],
  collaborationCommands["lock.release"],
]);

const planSchema = z
  .object({
    format: z.literal("codeboard-edit-plan/1"),
    projectId: id,
    actor: id,
    baseVersion: z.number().int().nonnegative().safe(),
    baseHash: hash,
    label: z.string().min(1).max(512),
    commands: z.array(commandSchema).min(1).max(1000),
    digest: hash,
  })
  .strict();

export const receiptSchema = z
  .object({
    requestId: id,
    digest: hash,
    projectId: id,
    actor: id,
    baseVersion: z.number().int().nonnegative().safe(),
    committedVersion: z.number().int().nonnegative().safe(),
    committedAt: z.iso.datetime(),
  })
  .strict();

function checkPlanSize(input: unknown): void {
  fingerprint(input);
  if (Buffer.byteLength(JSON.stringify(input)) > 1024 * 1024)
    throw new CodeboardError("RESOURCE_LIMIT", "Edit plan exceeds 1 MiB");
}

const planBodySchema = planSchema.omit({ digest: true });

/** Apply command defaults before binding the serializable intent to its digest. */
export function createPlan(input: Omit<EditPlan, "digest">): EditPlan {
  checkPlanSize(input);
  const result = planBodySchema.safeParse(input);
  if (!result.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid edit plan", {
      details: { issues: result.error.issues },
    });
  return parsePlan({ ...result.data, digest: fingerprint(result.data) });
}

export function parsePlan(input: unknown): EditPlan {
  checkPlanSize(input);
  const result = planSchema.safeParse(input);
  if (!result.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid edit plan", {
      details: { issues: result.error.issues },
    });
  const { digest, ...body } = result.data;
  if (fingerprint(body) !== digest)
    throw new CodeboardError("INVALID_ARGUMENT", "Edit plan digest does not match its contents");
  return result.data as EditPlan;
}
