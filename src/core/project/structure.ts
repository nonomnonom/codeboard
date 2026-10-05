import { copyComponentOrigins } from "../../model/component-origins.js";
import type { Id, Panel, PanelOptions, StoryboardDocument } from "../../model/types.js";
import { reflowTimeline } from "../../animation/board-reflow.js";
import { retimePanel } from "../../animation/retime.js";
import { findScene, findShot } from "../../model/structure.js";
import { findPanel, visitLayers, cloneLayersWithIdentities } from "../../model/layers.js";
import { removeReviewAnchors } from "../../model/review.js";
import { assertRemovalUnlocked } from "../../model/locks.js";

export function addSequence(
  document: StoryboardDocument,
  nextId: (prefix: string) => Id,
  name: string,
  id?: Id,
): Id {
  const sequenceId = id ?? nextId("sequence");
  document.sequences.push({ id: sequenceId, name, sceneIds: [] });
  return sequenceId;
}

export function addScene(
  document: StoryboardDocument,
  nextId: (prefix: string) => Id,
  sequenceId: Id,
  name: string,
  id?: Id,
): Id {
  const sequence = document.sequences.find((s) => s.id === sequenceId);
  if (!sequence) throw new Error(`Sequence not found: ${sequenceId}`);
  const sceneId = id ?? nextId("scene");
  document.scenes.push({ id: sceneId, name, sequenceId, shotIds: [] });
  sequence.sceneIds.push(sceneId);
  document.scenes = document.sequences.flatMap((s) =>
    s.sceneIds.map((id) => document.scenes.find((s) => s.id === id)!),
  );
  return sceneId;
}

export function addShot(
  document: StoryboardDocument,
  nextId: (prefix: string) => Id,
  sceneId: Id,
  name: string,
  id?: Id,
): Id {
  let shotId = "";
  const scene = findScene(document, sceneId);
  shotId = id ?? nextId("shot");
  document.shots.push({ id: shotId, sceneId, name, panelIds: [], cameraKeyframes: [] });
  scene.shotIds.push(shotId);

  return shotId;
}

export function addPanel(
  document: StoryboardDocument,
  nextId: (prefix: string) => Id,
  shotId: Id,
  options: PanelOptions,
): Id {
  let panelId = "";
  editTimelineStructure(document, () => {
    const shot = findShot(document, shotId);
    panelId = options.id ?? nextId("panel");
    const startFrame = document.panels.reduce(
      (maximum, entry) => Math.max(maximum, entry.startFrame + entry.durationFrames),
      0,
    );
    const panel: Panel = {
      id: panelId,
      shotId,
      number: options.number ?? String(document.panels.length + 1),
      title: options.title ?? "Untitled panel",
      width: options.width ?? document.canvas.width,
      height: options.height ?? document.canvas.height,
      durationFrames: options.durationFrames ?? 48,
      startFrame,
      transition: { type: "cut", durationFrames: 0 },
      status: "working",
      action: options.action ?? "",
      dialogue: options.dialogue ?? "",
      camera: options.camera ?? "",
      notes: options.notes ?? "",
      layers: [],
      motion: [],
      revision: 0,
    };
    document.panels.push(panel);
    shot.panelIds.push(panelId);
  });
  return panelId;
}

export function updatePanel(
  document: StoryboardDocument,
  panelId: Id,
  changes: Partial<
    Pick<Panel, "title" | "durationFrames" | "action" | "dialogue" | "camera" | "notes">
  >,
): void {
  const panel = findPanel(document, panelId);
  const { durationFrames, ...metadata } = changes;
  if (durationFrames !== undefined) retimePanel(document, panelId, durationFrames);
  Object.assign(panel, metadata);
  panel.revision += 1;
}

export function movePanel(document: StoryboardDocument, panelId: Id, beforePanelId?: Id): void {
  editTimelineStructure(document, () => {
    const panel = findPanel(document, panelId);
    const shot = document.shots.find((entry) => entry.id === panel.shotId)!;
    shot.panelIds = shot.panelIds.filter((id) => id !== panelId);
    const index = beforePanelId ? shot.panelIds.indexOf(beforePanelId) : shot.panelIds.length;
    if (index < 0) throw new Error(`Destination panel is not in shot ${shot.id}`);
    shot.panelIds.splice(index, 0, panelId);
  });
}

export function duplicatePanel(
  document: StoryboardDocument,
  nextId: (prefix: string) => Id,
  panelId: Id,
): Id {
  let created = "";
  editTimelineStructure(document, () => {
    const source = findPanel(document, panelId);
    const shot = document.shots.find((entry) => entry.id === source.shotId)!;
    created = nextId("panel");
    const copied = cloneLayersWithIdentities(source.layers, nextId);
    const copy: Panel = {
      ...structuredClone(source),
      id: created,
      number: `${source.number}A`,
      title: `${source.title} copy`,
      layers: copied.layers,
      motion: source.motion.map((motion) => ({ ...motion, id: nextId("motion") })),
      revision: 0,
    };
    const index = shot.panelIds.indexOf(panelId) + 1;
    shot.panelIds.splice(index, 0, created);
    document.panels.push(copy);
    copyComponentOrigins(document, copied, nextId);
  });
  return created;
}

export function deletePanel(document: StoryboardDocument, panelId: Id): void {
  editTimelineStructure(document, () => {
    const panel = findPanel(document, panelId);
    const shot = document.shots.find((entry) => entry.id === panel.shotId)!;
    if (shot.panelIds.length <= 1) throw new Error("A shot must keep at least one panel");
    const removedIds = new Set<Id>([panelId]);
    visitLayers(panel.layers, (layer) => {
      removedIds.add(layer.id);
      if (layer.kind !== "group") for (const element of layer.elements) removedIds.add(element.id);
    });
    assertRemovalUnlocked(document, removedIds);
    const end = panel.startFrame + panel.durationFrames;
    if (
      document.audioTracks.some((t) =>
        t.clips.some((c) => c.startFrame >= panel.startFrame && c.startFrame < end),
      )
    )
      throw new Error(
        "Panel contains audio cues; remove or reposition those clips before deleting it",
      );
    shot.cameraKeyframes = shot.cameraKeyframes.filter(
      (k) => k.frame < panel.startFrame || k.frame >= end,
    );
    shot.panelIds = shot.panelIds.filter((id) => id !== panelId);
    document.panels = document.panels.filter((entry) => entry.id !== panelId);
    removeReviewAnchors(document, removedIds);
    document.comments = document.comments.filter(
      ({ anchor }) =>
        !(
          anchor.panelId === undefined &&
          anchor.layerId === undefined &&
          anchor.elementId === undefined &&
          anchor.frame !== undefined &&
          anchor.frame >= panel.startFrame &&
          anchor.frame < end
        ),
    );
  });
}

/** Structural changes stage reference lists; reflow checks locks, ranges and camera collisions before timing writes. */
export function editTimelineStructure<T>(document: StoryboardDocument, work: () => T): T {
  const original = {
    shots: document.shots,
    panels: document.panels,
    comments: document.comments,
    idCounter: document.idCounter,
  };
  document.shots = original.shots.map((shot) => ({
    ...shot,
    panelIds: shot.panelIds.slice(),
    cameraKeyframes: shot.cameraKeyframes.slice(),
  }));
  document.panels = original.panels.slice();
  document.comments = original.comments.slice();
  try {
    const result = work();
    reflowTimeline(document);
    return result;
  } catch (error) {
    Object.assign(document, original);
    throw error;
  }
}
