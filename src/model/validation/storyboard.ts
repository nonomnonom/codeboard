import type { StoryboardDocument } from "../types.js";
import { validateKeyframePositions, validateArtwork } from "./artwork.js";

export function validateBoardRelationships(
  d: Pick<StoryboardDocument, "sequences" | "scenes" | "shots" | "panels">,
): void {
  const fail = (message: string): never => {
    throw new Error(message);
  };
  const seenShots = new Set<string>();
  const sceneOrder = d.sequences.flatMap((s) => s.sceneIds);
  if (
    new Set(sceneOrder).size !== sceneOrder.length ||
    JSON.stringify(sceneOrder) !== JSON.stringify(d.scenes.map((s) => s.id))
  )
    fail("Sequence scene order/ownership is invalid");
  for (const s of d.scenes)
    if (!d.sequences.some((q) => q.id === s.sequenceId && q.sceneIds.includes(s.id)))
      fail(`Missing sequence for ${s.id}`);
  const seenPanels = new Set<string>();
  let cursor = 0;
  for (const scene of d.scenes)
    for (const shotId of scene.shotIds) {
      const shot = d.shots.find((s) => s.id === shotId);
      if (!shot || shot.sceneId !== scene.id || seenShots.has(shotId))
        fail(`Invalid shot ownership: ${shotId}`);
      seenShots.add(shotId);
      validateKeyframePositions(shot!.cameraKeyframes, shotId);
      for (const panelId of shot!.panelIds) {
        const p = d.panels.find((p) => p.id === panelId);
        if (!p || p.shotId !== shotId || seenPanels.has(panelId))
          fail(`Invalid panel ownership: ${panelId}`);
        seenPanels.add(panelId);
        if (p!.startFrame !== cursor)
          fail(`Panel ${panelId} must start at frame ${cursor}; found ${p!.startFrame}`);
        cursor += p!.durationFrames;
        if (p!.transition.durationFrames >= p!.durationFrames)
          fail(`Transition exceeds panel ${panelId}`);
        validateArtwork(p!.layers);
      }
    }
  if (seenShots.size !== d.shots.length || seenPanels.size !== d.panels.length)
    fail("Orphaned shot or panel");
}
