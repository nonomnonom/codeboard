import { z } from "zod";
import { storyboardSchema } from "../schema/project.js";
import type { StoryboardDocument } from "../types.js";

export const projectSummarySchema = storyboardSchema
  .pick({
    id: true,
    title: true,
    schemaVersion: true,
    version: true,
    canvas: true,
    frameRate: true,
  })
  .extend({
    titleTruncated: z.literal(true).optional(),
    durationFrames: z.number().int().nonnegative(),
    counts: z
      .object({
        sequences: z.number().int().nonnegative(),
        scenes: z.number().int().nonnegative(),
        shots: z.number().int().nonnegative(),
        panels: z.number().int().nonnegative(),
        components: z.number().int().nonnegative(),
        assets: z.number().int().nonnegative(),
        audioTracks: z.number().int().nonnegative(),
        comments: z.number().int().nonnegative(),
        locks: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export function summarizeProjectMetadata(
  document: Omit<StoryboardDocument, "panels" | "components" | "changes" | "studio"> & {
    panels: readonly { startFrame: number; durationFrames: number }[];
    components: readonly unknown[];
  },
) {
  return {
    id: document.id,
    title: document.title.slice(0, 256),
    ...(document.title.length > 256 ? { titleTruncated: true } : {}),
    schemaVersion: document.schemaVersion,
    version: document.version,
    canvas: { ...document.canvas },
    frameRate: document.frameRate,
    durationFrames: document.panels.reduce(
      (end, panel) => Math.max(end, panel.startFrame + panel.durationFrames),
      0,
    ),
    counts: {
      sequences: document.sequences.length,
      scenes: document.scenes.length,
      shots: document.shots.length,
      panels: document.panels.length,
      components: document.components.length,
      assets: document.assets.length,
      audioTracks: document.audioTracks.length,
      comments: document.comments.length,
      locks: document.locks.length,
    },
  };
}

export function summarizeProject(document: StoryboardDocument) {
  let audioTracks = 0,
    audioClips = 0;
  for (const owner of [...document.studio.animations, ...document.studio.editorial]) {
    audioTracks += owner.audio?.length ?? 0;
    for (const track of owner.audio ?? []) audioClips += track.clips.length;
  }
  return {
    ...summarizeProjectMetadata(document),
    studio: {
      animations: document.studio.animations.length,
      editorialSequences: document.studio.editorial.length,
      editorialClips: document.studio.editorial.reduce(
        (count, sequence) => count + sequence.clips.length,
        0,
      ),
      audioTracks,
      audioClips,
    },
  };
}
