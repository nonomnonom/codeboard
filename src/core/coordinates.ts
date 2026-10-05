import type { StoryboardDocument } from "../model/types.js";
import { assertRenderFrame } from "../animation/frame.js";
import {
  artworkCoordinates,
  type CoordinateOptions,
  type ArtworkCoordinateSpace,
} from "../animation/coordinates.js";

export type { CoordinateOptions } from "../animation/coordinates.js";
export interface CoordinateSpace extends ArtworkCoordinateSpace {
  panelId: string;
}

export function coordinateSpace(
  document: StoryboardDocument,
  targetId: string,
  options: CoordinateOptions = {},
): CoordinateSpace {
  for (const panel of document.panels) {
    const frame = options.frame ?? panel.startFrame;
    const shot = document.shots.find((item) => item.id === panel.shotId);
    const space = artworkCoordinates(
      panel.layers,
      shot?.cameraKeyframes ?? [],
      panel.width,
      panel.height,
      targetId,
      frame,
      options.camera !== false,
    );
    if (!space) continue;
    assertRenderFrame(frame);
    return { panelId: panel.id, ...space };
  }
  throw new Error(`Coordinate target is not a layer or drawing element in a panel: ${targetId}`);
}
