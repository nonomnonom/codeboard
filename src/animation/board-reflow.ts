import type { Id, Panel, StoryboardDocument } from "../model/types.js";
import { CodeboardError } from "../model/errors.js";
import { findPanel, visitLayers } from "../model/layers.js";

export function orderedPanels(document: StoryboardDocument, shotId: Id): Panel[] {
  const shot = document.shots.find((entry) => entry.id === shotId);
  if (!shot) throw new Error(`Shot not found: ${shotId}`);
  return shot.panelIds.map((id) => findPanel(document, id));
}

export function reflowTimeline(document: StoryboardDocument): void {
  const offsets = new Map<string, number>();
  const updates: (() => void)[] = [];
  const safe = (value: number) => {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Timeline reflow exceeds the safe integer frame range",
        {
          details: { reason: "REFLOW_FRAME_RANGE", operation: "board-reflow", value },
        },
      );
    return value;
  };
  const shiftKey = (key: { frame: number }, delta: number) => {
    const frame = safe(key.frame + delta);
    updates.push(() => {
      key.frame = frame;
    });
  };
  const shiftRange = (range: { startFrame: number; endFrame: number }, delta: number) => {
    const startFrame = safe(range.startFrame + delta);
    const endFrame = safe(range.endFrame + delta);
    updates.push(() => {
      range.startFrame = startFrame;
      range.endFrame = endFrame;
    });
  };
  const before = document.panels.map((p) => ({
    id: p.id,
    start: p.startFrame,
    end: safe(p.startFrame + p.durationFrames),
  }));
  let cursor = 0;
  for (const scene of document.scenes)
    for (const shotId of scene.shotIds)
      for (const panel of orderedPanels(document, shotId)) {
        const start = cursor,
          delta = start - panel.startFrame;
        offsets.set(panel.id, delta);
        cursor = safe(cursor + panel.durationFrames);
        const revision = panel.revision + (delta ? 1 : 0);
        if (!Number.isSafeInteger(revision))
          throw new CodeboardError(
            "RESOURCE_LIMIT",
            "Panel revision exceeds the safe integer range",
            {
              details: { reason: "PANEL_REVISION_LIMIT", panelId: panel.id },
            },
          );
        updates.push(() => {
          panel.startFrame = start;
          panel.revision = revision;
        });
        if (delta) {
          visitLayers(panel.layers, (layer) => {
            for (const key of layer.keyframes) shiftKey(key, delta);
            if (layer.exposure) shiftRange(layer.exposure, delta);
            if (layer.kind === "group")
              for (const key of layer.drawingSequence ?? []) shiftKey(key, delta);
            else
              for (const element of layer.elements)
                if (element.kind === "raster-stroke" && element.reveal)
                  shiftRange(element.reveal, delta);
          });
        }
      }
  const map = (frame: number) => {
    const p = before.find((p) => frame >= p.start && frame < p.end);
    return safe(frame + (p ? (offsets.get(p.id) ?? 0) : 0));
  };
  for (const shot of document.shots) {
    const positions = new Map<number, number>();
    for (const key of shot.cameraKeyframes) {
      const frame = map(key.frame);
      if (positions.has(frame))
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          `Timeline reflow collapses camera keyframes in ${shot.id}`,
          {
            details: {
              reason: "FRAME_COLLISION",
              operation: "board-reflow",
              ownerId: shot.id,
              collection: "keyframes",
              targetFrame: frame,
              sourceFrames: [positions.get(frame)!, key.frame],
            },
          },
        );
      positions.set(frame, key.frame);
      updates.push(() => {
        key.frame = frame;
      });
    }
    updates.push(() => shot.cameraKeyframes.sort((a, b) => a.frame - b.frame));
  }
  for (const track of document.audioTracks)
    for (const clip of track.clips) {
      const frame = map(clip.startFrame);
      safe(frame + clip.durationFrames);
      if (frame !== clip.startFrame && track.locked)
        throw new Error(`Audio track is locked: ${track.id}`);
      updates.push(() => {
        clip.startFrame = frame;
      });
    }
  for (const comment of document.comments)
    if (comment.anchor.frame !== undefined) {
      const frame = map(comment.anchor.frame);
      updates.push(() => {
        comment.anchor.frame = frame;
      });
    }
  for (const update of updates) update();
  document.panels.sort((a, b) => a.startFrame - b.startFrame);
}
