import type { StoryboardDocument, Id, PageOptions } from "../../../model/types.js";
import { findPanel } from "../../../model/layers.js";
import { pageBounds, boundQueryResponse } from "../../../model/query.js";
import { selectFramePanels } from "../../../animation/frame.js";
import { CodeboardError } from "../../../model/errors.js";

export function readChanges(document: StoryboardDocument, version: number, options: PageOptions) {
  if (!Number.isSafeInteger(version) || version < 0)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Audit version must be a nonnegative safe integer",
    );
  const { limit, offset } = pageBounds(options),
    result: StoryboardDocument["changes"] = [];
  let skipped = 0;
  for (const change of document.changes) {
    if (change.version <= version) continue;
    if (skipped++ < offset) continue;
    result.push(change);
    if (result.length === limit) break;
  }
  return structuredClone(boundQueryResponse(result));
}

export function readLock(document: StoryboardDocument, id: Id) {
  const lock = document.locks.find((entry) => entry.id === id);
  if (!lock) throw new CodeboardError("INVALID_ARGUMENT", `Lock not found: ${id}`);
  return structuredClone(lock);
}

export function readRenderPanels(
  document: StoryboardDocument,
  ids: readonly Id[],
): Pick<StoryboardDocument, "canvas" | "panels" | "shots"> {
  const panels = [...new Set(ids)].map((id) => findPanel(document, id));
  const shots = new Set(panels.map((panel) => panel.shotId));
  return structuredClone({
    canvas: document.canvas,
    panels,
    shots: document.shots.filter((shot) => shots.has(shot.id)),
  });
}

export function readRenderFrame(
  document: StoryboardDocument,
  frame: number,
): Pick<StoryboardDocument, "canvas" | "panels" | "shots"> {
  const { panel, incoming } = selectFramePanels(document.panels, frame);
  return readRenderPanels(document, incoming ? [panel.id, incoming.id] : [panel.id]);
}
