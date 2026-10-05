import type { StoryboardDocument } from "../types.js";
import { storyboardSchema } from "../schema/project.js";
import { validateBrushResources } from "./brushes.js";
import { validateArtwork } from "./artwork.js";
import { validateAudioFades } from "./audio.js";
import { allLayers as identityLayers } from "../layers.js";
import { upgradeDocument } from "../migration.js";
import { validateScriptLinks } from "./script.js";
import { validatePaletteBindings } from "../palettes.js";
import { validateStudioRelationships } from "./studio.js";
import { validateBoardRelationships } from "./storyboard.js";

export function parseStoryboardDocument(input: unknown): StoryboardDocument {
  const document = storyboardSchema.parse(upgradeDocument(input)) as StoryboardDocument;
  assertUniqueIds(document);
  validateRelationships(document);
  return document;
}

export function validateRelationships(d: StoryboardDocument): void {
  validatePaletteBindings(d);
  validateScriptLinks(d);
  validateStudioRelationships(d);
  const fail = (message: string): never => {
    throw new Error(message);
  };
  validateBoardRelationships(d);
  const allLayers = [...d.panels, ...d.studio.animations].flatMap((p) => identityLayers(p.layers));
  const sourceLayers = d.components.flatMap((c) => identityLayers(c.layers));
  for (const l of [...allLayers, ...sourceLayers])
    if (
      l.componentSource &&
      !d.components.some(
        (c) => c.id === l.componentSource!.id && c.version >= l.componentSource!.version,
      )
    )
      fail(`Missing component source: ${l.id}`);
  for (const comment of d.comments) {
    if (comment.anchor.panelId && !d.panels.some((p) => p.id === comment.anchor.panelId))
      fail(`Missing comment panel: ${comment.id}`);
    if (comment.anchor.layerId && !allLayers.some((l) => l.id === comment.anchor.layerId))
      fail(`Missing comment layer: ${comment.id}`);
    if (
      comment.anchor.elementId &&
      !allLayers.some(
        (l) => l.kind !== "group" && l.elements.some((e) => e.id === comment.anchor.elementId),
      )
    )
      fail(`Missing comment element: ${comment.id}`);
  }
  for (const lock of d.locks)
    if (
      lock.targetType === "project"
        ? lock.targetId !== d.id
        : lock.targetType === "panel"
          ? !d.panels.some((p) => p.id === lock.targetId)
          : !allLayers.some((l) => l.id === lock.targetId)
    )
      fail(`Missing lock target: ${lock.id}`);
  for (const component of d.components) validateArtwork(component.layers);
  for (const brush of d.brushes) validateBrushResources(brush, brush.id);
  for (const track of d.audioTracks)
    for (const clip of track.clips) {
      if (!d.assets.some((a) => a.id === clip.assetId && a.kind === "audio"))
        fail(`Missing audio asset: ${clip.assetId}`);
      validateAudioFades(clip);
    }
}

export function documentIdentityIds(document: StoryboardDocument): string[] {
  const ids: string[] = [document.id];
  for (const palette of document.studio.palettes ?? [])
    ids.push(palette.id, ...palette.swatches.map((swatch) => swatch.id));
  for (const owner of [...document.studio.animations, ...document.studio.editorial])
    for (const track of owner.audio ?? [])
      ids.push(track.id, ...track.clips.map((clip) => clip.id));
  for (const animation of document.studio.animations) {
    ids.push(
      animation.id,
      ...animation.cameraKeyframes.map((key) => key.id),
      ...(animation.controllers ?? []).map((controller) => controller.id),
    );
    for (const layer of identityLayers(animation.layers)) {
      ids.push(layer.id, ...layer.keyframes.map((key) => key.id));
      if (layer.kind !== "group") ids.push(...layer.elements.map((element) => element.id));
    }
  }
  for (const sequence of document.studio.editorial)
    ids.push(sequence.id, ...sequence.clips.map((clip) => clip.id));
  ids.push(...document.sequences.map((s) => s.id));
  ids.push(
    ...document.scenes.map((item) => item.id),
    ...document.shots.map((item) => item.id),
    ...document.panels.map((item) => item.id),
  );
  for (const panel of document.panels) {
    for (const layer of identityLayers(panel.layers)) {
      ids.push(layer.id);
      ids.push(...layer.keyframes.map((keyframe) => keyframe.id));
      if (layer.kind !== "group") ids.push(...layer.elements.map((element) => element.id));
    }
    ids.push(...panel.motion.map((motion) => motion.id));
  }
  for (const shot of document.shots)
    ids.push(...shot.cameraKeyframes.map((keyframe) => keyframe.id));
  ids.push(
    ...document.assets.map((asset) => asset.id),
    ...document.audioTracks.map((track) => track.id),
  );
  ids.push(...document.brushes.map((brush) => brush.id));
  for (const c of document.components) {
    ids.push(c.id);
    for (const l of identityLayers(c.layers)) {
      ids.push(l.id, ...l.keyframes.map((k) => k.id));
      if (l.kind !== "group") ids.push(...l.elements.map((e) => e.id));
    }
  }
  for (const track of document.audioTracks) ids.push(...track.clips.map((clip) => clip.id));
  ids.push(
    ...document.comments.map((comment) => comment.id),
    ...document.locks.map((lock) => lock.id),
    ...document.changes.map((change) => change.id),
  );
  if (document.studio.script)
    ids.push(document.studio.script.id, ...document.studio.script.entries.map((entry) => entry.id));
  return ids;
}

export function assertUniqueIds(document: StoryboardDocument): void {
  const seen = new Set<string>();
  for (const id of documentIdentityIds(document)) {
    if (seen.has(id)) throw new Error(`Duplicate stable id: ${id}`);
    seen.add(id);
  }
}
