import type { StoryboardDocument, Id, PageOptions } from "../../../model/types.js";
import { findPanel } from "../../../model/layers.js";
import { pageBounds, boundQueryResponse } from "../../../model/query.js";
import { CodeboardError } from "../../../model/errors.js";

export function readBoardPanels(document: StoryboardDocument, options: PageOptions) {
  const { offset, limit } = pageBounds(options);
  return structuredClone(
    boundQueryResponse(
      [...document.panels]
        .sort((a, b) => a.startFrame - b.startFrame)
        .slice(offset, offset + limit)
        .map(({ id, shotId, startFrame, durationFrames, transition, width, height, revision }) => ({
          id,
          shotId,
          startFrame,
          durationFrames,
          transition,
          width,
          height,
          revision,
        })),
    ),
  );
}

export function readScriptSummary(document: StoryboardDocument) {
  const script = document.studio.script;
  return script
    ? boundQueryResponse({
        id: script.id,
        title: script.title,
        revision: script.revision,
        entryCount: script.entries.length,
      })
    : null;
}

export function readScriptEntries(document: StoryboardDocument, options: PageOptions) {
  const { offset, limit } = pageBounds(options);
  return structuredClone(
    boundQueryResponse(document.studio.script?.entries.slice(offset, offset + limit) ?? []),
  );
}

export function readPanelCaptions(document: StoryboardDocument, id: Id) {
  const panel = document.panels.find((entry) => entry.id === id);
  if (!panel)
    throw new CodeboardError("INVALID_ARGUMENT", `Panel not found: ${id}`, {
      details: { panelId: id },
    });
  const { title, action, dialogue, camera, notes } = panel;
  return boundQueryResponse({ id, title, action, dialogue, camera, notes });
}

export function readCameraKeyframes(document: StoryboardDocument, id: Id, options: PageOptions) {
  const { limit, offset } = pageBounds(options),
    shot =
      document.shots.find((shot) => shot.id === id) ??
      document.studio.animations.find((animation) => animation.id === id);
  if (!shot) throw new CodeboardError("INVALID_ARGUMENT", `Shot not found: ${id}`);
  return structuredClone(
    boundQueryResponse(
      [...shot.cameraKeyframes].sort((a, b) => a.frame - b.frame).slice(offset, offset + limit),
    ),
  );
}

export function readEditorialClips(document: StoryboardDocument, id: string, options: PageOptions) {
  const { offset, limit } = pageBounds(options);
  const sequence = document.studio.editorial.find((item) => item.id === id);
  if (!sequence)
    throw new CodeboardError("INVALID_ARGUMENT", `Editorial sequence not found: ${id}`);
  return structuredClone(boundQueryResponse(sequence.clips.slice(offset, offset + limit)));
}

export function readShotBoardPanels(
  document: StoryboardDocument,
  animationId: string,
  options: PageOptions,
) {
  const { offset, limit } = pageBounds(options);
  const animation = document.studio.animations.find((entry) => entry.id === animationId);
  if (!animation)
    throw new CodeboardError("INVALID_ARGUMENT", `Shot animation not found: ${animationId}`);
  return structuredClone(
    boundQueryResponse(
      (animation.boardPanelIds ?? []).slice(offset, offset + limit).map((id) => {
        const panel = findPanel(document, id);
        const { layers: _layers, motion: _motion, ...metadata } = panel;
        return metadata;
      }),
    ),
  );
}
