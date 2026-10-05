import { pageBounds, boundQueryResponse } from "../query.js";
import { z } from "zod";
import type {
  Layer,
  ObjectQuery,
  ObjectSummary,
  ObjectPage,
  StoryboardDocument,
} from "../types.js";

/** Metadata traversal shared by authoring queries and the derived storage catalog. */
export function objectEntries(
  document: StoryboardDocument,
  panelFilter?: string,
): Iterable<ObjectSummary> {
  const panelOwners = new Map<string, string>();
  function* layers(entries: Layer[], parentId: string, panelId?: string): Generator<ObjectSummary> {
    for (const layer of entries) {
      yield {
        id: layer.id,
        kind: layer.kind,
        name: layer.name,
        parentId,
        ...(panelId ? { panelId } : {}),
      };
      for (const key of layer.keyframes)
        yield {
          id: key.id,
          kind: "layer-key",
          name: "",
          parentId: layer.id,
          ...(panelId ? { panelId } : {}),
        };
      if (layer.kind === "group") yield* layers(layer.children, layer.id, panelId);
      else
        for (const element of layer.elements)
          yield {
            id: element.id,
            kind: element.kind,
            name: element.name ?? "",
            parentId: layer.id,
            ...(panelId ? { panelId } : {}),
          };
    }
  }
  function* entries(): Generator<ObjectSummary> {
    if (panelFilter === undefined) {
      yield { id: document.id, kind: "project", name: document.title };
      for (const palette of document.studio.palettes ?? []) {
        yield { id: palette.id, kind: "palette", name: palette.name, parentId: document.id };
        for (const swatch of palette.swatches)
          yield { id: swatch.id, kind: "palette-swatch", name: swatch.name, parentId: palette.id };
      }
      if (document.studio.script) {
        yield {
          id: document.studio.script.id,
          kind: "script",
          name: document.studio.script.title,
          parentId: document.id,
        };
        for (const entry of document.studio.script.entries)
          yield {
            id: entry.id,
            kind: "script-entry",
            name: entry.speaker ?? entry.kind,
            parentId: document.studio.script.id,
          };
      }
      for (const sequence of document.sequences)
        yield { id: sequence.id, kind: "sequence", name: sequence.name, parentId: document.id };
      for (const scene of document.scenes)
        yield { id: scene.id, kind: "scene", name: scene.name, parentId: scene.sequenceId };
      for (const shot of document.shots) {
        yield { id: shot.id, kind: "shot", name: shot.name, parentId: shot.sceneId };
        for (const key of shot.cameraKeyframes)
          yield { id: key.id, kind: "camera-key", name: "", parentId: shot.id };
      }
    }
    for (const panel of document.panels) {
      if (panelFilter !== undefined && panelFilter !== panel.id) continue;
      yield {
        id: panel.id,
        kind: "panel",
        name: panel.title,
        panelId: panel.id,
        parentId: panel.shotId,
      };
      panelOwners.set(panel.id, panel.id);
      for (const item of layers(panel.layers, panel.id, panel.id)) {
        panelOwners.set(item.id, panel.id);
        yield item;
      }
      for (const motion of panel.motion)
        yield {
          id: motion.id,
          kind: "motion",
          name: motion.label,
          parentId: panel.id,
          panelId: panel.id,
        };
    }
    const ownerOf = (id: string | undefined): string | undefined =>
      id ? panelOwners.get(id) : undefined;
    for (const comment of document.comments) {
      const parentId =
        comment.anchor.elementId ?? comment.anchor.layerId ?? comment.anchor.panelId ?? document.id;
      const panelId = comment.anchor.panelId ?? ownerOf(parentId);
      if (panelFilter !== undefined && panelId !== panelFilter) continue;
      yield {
        id: comment.id,
        kind: "comment",
        name: comment.body,
        parentId,
        ...(panelId ? { panelId } : {}),
      };
    }
    for (const lock of document.locks) {
      const panelId = ownerOf(lock.targetId);
      if (panelFilter !== undefined && panelId !== panelFilter) continue;
      yield {
        id: lock.id,
        kind: "lock",
        name: lock.reason,
        parentId: lock.targetId,
        ...(panelId ? { panelId } : {}),
      };
    }
    if (panelFilter !== undefined) return;
    for (const animation of document.studio.animations) {
      yield {
        id: animation.id,
        kind: "shot-animation",
        name: animation.name,
        parentId: animation.shotId,
      };
      yield* layers(animation.layers, animation.id);
      for (const controller of animation.controllers ?? [])
        yield {
          id: controller.id,
          kind: "shot-controller",
          name: controller.name,
          parentId: animation.id,
        };
      for (const key of animation.cameraKeyframes)
        yield { id: key.id, kind: "shot-camera-key", name: "", parentId: animation.id };
    }
    for (const sequence of document.studio.editorial) {
      yield {
        id: sequence.id,
        kind: "editorial-sequence",
        name: sequence.id,
        parentId: document.id,
      };
      for (const clip of sequence.clips)
        yield { id: clip.id, kind: "editorial-clip", name: "", parentId: sequence.id };
    }
    for (const owner of [...document.studio.animations, ...document.studio.editorial])
      for (const track of owner.audio ?? []) {
        yield { id: track.id, kind: "studio-audio-track", name: track.name, parentId: owner.id };
        for (const clip of track.clips)
          yield { id: clip.id, kind: "studio-audio-clip", name: clip.name, parentId: track.id };
      }
    for (const component of document.components) {
      yield { id: component.id, kind: "component", name: component.name, parentId: document.id };
      yield* layers(component.layers, component.id);
    }
    for (const asset of document.assets)
      yield { id: asset.id, kind: `asset:${asset.kind}`, name: asset.name, parentId: document.id };
    for (const brush of document.brushes)
      yield { id: brush.id, kind: "brush", name: brush.name, parentId: document.id };
    for (const track of document.audioTracks) {
      yield { id: track.id, kind: "audio-track", name: track.name, parentId: document.id };
      for (const clip of track.clips)
        yield { id: clip.id, kind: "audio-clip", name: clip.name, parentId: track.id };
    }
  }
  return entries();
}

/** Shared metadata predicate; callers retain their own traversal and pagination order. */
export function matchesObjectQuery(
  entry: ObjectSummary,
  query: ObjectQuery,
  foldedName = query.name?.toLowerCase(),
): boolean {
  return (
    (foldedName === undefined || entry.name.toLowerCase().includes(foldedName)) &&
    (query.kind === undefined || entry.kind === query.kind) &&
    (query.parentId === undefined || entry.parentId === query.parentId) &&
    (query.panelId === undefined || entry.panelId === query.panelId) &&
    (query.id === undefined || entry.id === query.id)
  );
}

export function findObjects(document: StoryboardDocument, query: ObjectQuery): ObjectSummary[] {
  const { limit: maximum, offset } = pageBounds(query),
    name = query.name?.toLowerCase();
  const result: ObjectSummary[] = [];
  let skipped = 0;
  for (const entry of objectEntries(document, query.panelId)) {
    if (!matchesObjectQuery(entry, query, name)) continue;
    if (skipped++ < offset) continue;
    result.push(entry);
    if (result.length === maximum || query.id !== undefined) break;
  }
  return result;
}

export const objectQuerySchema = z
  .object({
    name: z.string().optional(),
    kind: z.string().optional(),
    panelId: z.string().optional(),
    parentId: z.string().optional(),
    id: z.string().optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
  })
  .strict();

export function boundObjectPage(page: ObjectPage): ObjectPage {
  page.items = page.items.map((item) =>
    item.name.length <= 256
      ? item
      : { ...item, name: item.name.slice(0, 256), nameTruncated: true },
  );
  return boundQueryResponse(page, "Object page");
}
