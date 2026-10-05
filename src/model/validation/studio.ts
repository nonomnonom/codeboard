import { validateComponentOrigins } from "../component-origins.js";
import type { StoryboardDocument } from "../types.js";
import { defineShotAnimation } from "../../animation/shot.js";
import { defineEditorialSequence } from "../../animation/editorial.js";

export function validateStudioRelationships(
  d: Pick<StoryboardDocument, "studio" | "shots" | "panels" | "assets">,
): void {
  validateComponentOrigins(d.studio.componentOrigins ?? []);
  for (const animation of d.studio.animations) {
    if (!d.shots.some((shot) => shot.id === animation.shotId))
      throw new Error(`Missing shot for animation: ${animation.id}`);
    for (const panelId of animation.boardPanelIds ?? []) {
      const panel = d.panels.find((entry) => entry.id === panelId);
      if (!panel || panel.shotId !== animation.shotId)
        throw new Error(`Board panel ${panelId} must belong to animation shot ${animation.shotId}`);
    }
    defineShotAnimation(animation);
  }
  for (const sequence of d.studio.editorial) defineEditorialSequence(sequence, d.studio.animations);
  for (const owner of [...d.studio.animations, ...d.studio.editorial])
    for (const track of owner.audio ?? [])
      for (const clip of track.clips) {
        if (!d.assets.some((asset) => asset.id === clip.assetId && asset.kind === "audio"))
          throw new Error(`Missing studio audio asset: ${clip.assetId}`);
      }
}
