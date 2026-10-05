import { z } from "zod";
import type { StoryboardDocument } from "./types.js";
import { collectShotDependencies } from "./shot-dependencies.js";
import { parseStoryboardDocument } from "./validation/document.js";
import { CodeboardError } from "./errors.js";

export interface ShotSubsetOptions {
  projectId: string;
  title?: string;
}
const optionsSchema = z
  .object({
    projectId: z.string().min(1).max(4096),
    title: z.string().optional(),
  })
  .strict();

/** Extract from a validated document; preserve artwork identities for isolated shot work. */
export function createShotSubset(
  document: StoryboardDocument,
  animationId: string,
  input: ShotSubsetOptions,
): StoryboardDocument {
  const parsed = optionsSchema.safeParse(input);
  if (!parsed.success || parsed.data.projectId === document.id)
    throw new CodeboardError("INVALID_ARGUMENT", "Shot subset requires a distinct project ID");
  const { items } = collectShotDependencies(document, animationId);
  const missing = items.find((entry) => entry.status === "missing");
  if (missing)
    throw new CodeboardError("MISSING_DEPENDENCY", "Shot subset has a missing resource", {
      details: { kind: missing.kind, id: missing.id },
    });
  const selected = (kind: (typeof items)[number]["kind"]) =>
    new Set(items.filter((entry) => entry.kind === kind).map((entry) => entry.id));
  const componentIds = selected("component"),
    paletteIds = selected("palette"),
    originIds = selected("origin"),
    assetIds = selected("asset");
  const animation = document.studio.animations.find((entry) => entry.id === animationId)!;
  const shot = document.shots.find((entry) => entry.id === animation.shotId)!;
  const scene = document.scenes.find((entry) => entry.id === shot.sceneId)!;
  const sequence = document.sequences.find((entry) => entry.id === scene.sequenceId)!;
  return parseStoryboardDocument(
    structuredClone({
      schemaVersion: document.schemaVersion,
      version: 0,
      id: parsed.data.projectId,
      title: parsed.data.title ?? animation.name,
      ...(document.author === undefined ? {} : { author: document.author }),
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      canvas: animation.canvas,
      seed: document.seed,
      frameRate: document.frameRate,
      idCounter: document.idCounter,
      sequences: [{ ...sequence, sceneIds: [scene.id] }],
      scenes: [{ ...scene, shotIds: [shot.id] }],
      shots: [{ ...shot, panelIds: [], cameraKeyframes: [] }],
      panels: [],
      brushes: [],
      assets: document.assets.filter((entry) => assetIds.has(entry.id)),
      components: document.components.filter((entry) => componentIds.has(entry.id)),
      audioTracks: [],
      comments: [],
      locks: [],
      changes: [],
      metadata: {
        "shotSubset.sourceProjectId": document.id,
        "shotSubset.sourceVersion": String(document.version),
        "shotSubset.animationId": animationId,
      },
      studio: {
        animations: [{ ...animation, boardPanelIds: [] }],
        editorial: [],
        palettes: (document.studio.palettes ?? []).filter((entry) => paletteIds.has(entry.id)),
        componentOrigins: (document.studio.componentOrigins ?? []).filter((entry) =>
          originIds.has(entry.instanceId),
        ),
      },
    }),
  );
}
