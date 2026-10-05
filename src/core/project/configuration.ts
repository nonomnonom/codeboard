import type { ProjectOptions, ProjectChanges, StoryboardDocument } from "../../model/types.js";
import { projectChangesSchema } from "../../model/schema/configuration.js";
import { parseStoryboardDocument } from "../../model/validation/document.js";
import { convertTimebase } from "../../animation/timebase.js";
import { brushes as builtinBrushes } from "../../drawing/brushes.js";

export function createProjectDocument(options: ProjectOptions): StoryboardDocument {
  const timestamp = new Date().toISOString();
  return {
    schemaVersion: 5,
    studio: { animations: [], editorial: [] },
    version: 0,
    id: options.id ?? "project:1",
    title: options.title,
    ...(options.author ? { author: options.author } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
    canvas: {
      width: options.width ?? 1280,
      height: options.height ?? 720,
      background: options.background ?? "#ffffff",
    },
    seed: options.seed ?? 1,
    frameRate: options.frameRate ?? 24,
    idCounter: 1,
    scenes: [],
    sequences: [{ id: "sequence:main", name: "Main sequence", sceneIds: [] }],
    shots: [],
    panels: [],
    brushes: Object.values(builtinBrushes).map((brush) => structuredClone(brush)),
    assets: [],
    audioTracks: [],
    comments: [],
    locks: [],
    changes: [],
    metadata: {},
    components: [],
  };
}

export function configureProjectDocument(
  document: StoryboardDocument,
  changes: ProjectChanges,
): StoryboardDocument {
  const input = projectChangesSchema.parse(changes);
  const next = structuredClone(document);
  if (input.title !== undefined) next.title = input.title;
  if (input.author === null) delete next.author;
  else if (input.author !== undefined) next.author = input.author;
  if (input.seed !== undefined) next.seed = input.seed;
  if (input.canvas) {
    const { applyTo = "new-panels", ...canvas } = input.canvas;
    Object.assign(
      next.canvas,
      Object.fromEntries(Object.entries(canvas).filter(([, value]) => value !== undefined)),
    );
    if (applyTo === "all-panels")
      for (const panel of next.panels) {
        if (canvas.width !== undefined) panel.width = canvas.width;
        if (canvas.height !== undefined) panel.height = canvas.height;
      }
  }
  if (input.frameRate && input.frameRate.value !== next.frameRate) {
    const lockedTrack = next.audioTracks.find((track) => track.locked && track.clips.length);
    if (lockedTrack)
      throw new Error(`Frame-rate conversion requires unlocking audio track ${lockedTrack.id}`);
    if (input.frameRate.timing === "preserve-seconds") convertTimebase(next, input.frameRate.value);
    else next.frameRate = input.frameRate.value;
  }
  const validated = parseStoryboardDocument(next);
  return validated;
}
