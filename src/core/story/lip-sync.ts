import type { StoryboardProject } from "../project.js";
import { compileLipSync, type LipSyncOptions } from "../../animation/lip-sync.js";
import { replaceDrawingWindow } from "../../animation/drawing-range.js";
import { locateLayer } from "../../model/layer-tree.js";
import { CodeboardError } from "../../model/errors.js";

/** Replace only the selected local-frame window of an existing shot mouth drawing track. */
export function planShotLipSync(
  project: StoryboardProject,
  animationId: string,
  layerId: string,
  options: LipSyncOptions,
) {
  const baked = compileLipSync(options);
  const animation = project.shotAnimation(animationId);
  const layer = locateLayer(animation.layers, layerId)?.layer;
  if (layer?.kind !== "group" || layer.drawingSequence === undefined)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Lip-sync requires a group with an existing drawing sequence",
    );
  const available = new Set(layer.children.map((child) => child.id));
  for (const key of baked)
    if (key.drawingId !== null && !available.has(key.drawingId))
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Mouth drawing must be a direct child of the selected group",
        { details: { drawingId: key.drawingId, layerId } },
      );
  const keys = replaceDrawingWindow(
    layer.drawingSequence,
    options.startFrame,
    options.endFrame,
    baked.filter((key) => key.frame < options.endFrame),
  );
  return project.plan("Revise shot lip-sync", [
    { op: "animation.edit", id: animationId, edits: [{ op: "layer.drawings", layerId, keys }] },
  ]);
}
