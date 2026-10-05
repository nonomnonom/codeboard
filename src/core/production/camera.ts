import {
  prepareBoardCameraKeyframe,
  omitBoardCameraKeyframeChannels,
} from "../../animation/board-keyframes.js";
import type { CameraKeyframeInput, CameraKeyframeChanges } from "../../model/types.js";
import type { Id, PageOptions, CameraChannel } from "../../model/types.js";
import { cameraKeyframeSchema } from "../../model/schema/animation.js";
import { validateKeyframePositions } from "../../model/validation/artwork.js";
import type { ProductionHost, MutationOptions } from "./host.js";

type Host = Pick<ProductionHost, "_applyProduction" | "_readCameraKeyframes">;

export function cameraKeyframes(host: Host, shotId: Id, options: PageOptions = {}) {
  return host._readCameraKeyframes(shotId, options);
}

export function addCameraKeyframe(
  host: Host,
  shotId: Id,
  frame: number,
  value: CameraKeyframeInput,
  options: MutationOptions = {},
): Id {
  let id = "";
  host._applyProduction(
    "add camera keyframe",
    [shotId],
    options.expectedVersion,
    (document, nextId) => {
      const shot = document.shots.find((entry) => entry.id === shotId);
      if (!shot) throw new Error(`Shot not found: ${shotId}`);
      const existing = shot.cameraKeyframes.find((key) => key.frame === frame);
      const keyframe = prepareBoardCameraKeyframe(frame, value, existing);
      id = existing?.id ?? nextId("camera-key");
      shot.cameraKeyframes = [
        ...shot.cameraKeyframes.filter((keyframe) => keyframe.frame !== frame),
        { ...keyframe, id },
      ].sort((a, b) => a.frame - b.frame);
    },
    { shotId },
  );
  return id;
}

export function updateCameraKeyframe(
  host: Host,
  shotId: Id,
  keyframeId: Id,
  changes: CameraKeyframeChanges,
  options: MutationOptions = {},
): void {
  host._applyProduction(
    "update camera keyframe",
    [shotId, keyframeId],
    options.expectedVersion,
    (document) => {
      const shot = document.shots.find((entry) => entry.id === shotId);
      const keyframe = shot?.cameraKeyframes.find((entry) => entry.id === keyframeId);
      if (!keyframe) throw new Error(`Camera keyframe not found: ${keyframeId}`);
      const proposed = cameraKeyframeSchema.parse({ ...keyframe, ...changes, id: keyframe.id });
      const keys = shot!.cameraKeyframes.map((entry) =>
        entry.id === keyframeId ? proposed : entry,
      );
      validateKeyframePositions(keys, shotId);
      shot!.cameraKeyframes = keys.sort((a, b) => a.frame - b.frame);
    },
    { shotId },
  );
}

export function removeCameraKeyframe(
  host: Host,
  shotId: Id,
  keyframeId: Id,
  options: MutationOptions = {},
): void {
  host._applyProduction(
    "remove camera keyframe",
    [shotId, keyframeId],
    options.expectedVersion,
    (document) => {
      const shot = document.shots.find((entry) => entry.id === shotId);
      if (!shot?.cameraKeyframes.some((entry) => entry.id === keyframeId))
        throw new Error(`Camera keyframe not found: ${keyframeId}`);
      shot.cameraKeyframes = shot.cameraKeyframes.filter((entry) => entry.id !== keyframeId);
    },
    { shotId },
  );
}

export function removeCameraKeyframeChannels(
  host: Host,
  shotId: Id,
  keyframeId: Id,
  channels: readonly CameraChannel[],
  options: MutationOptions = {},
): void {
  if (
    !channels.length ||
    new Set(channels).size !== channels.length ||
    channels.some((channel) => !["x", "y", "zoom", "rotation"].includes(channel))
  )
    throw new Error("Keyframe channels must be nonempty, unique supported property names");
  host._applyProduction(
    "remove camera keyframe channels",
    [shotId, keyframeId],
    options.expectedVersion,
    (document) => {
      const shot = document.shots.find((shot) => shot.id === shotId),
        key = shot?.cameraKeyframes.find((key) => key.id === keyframeId);
      if (!shot || !key) throw new Error(`Camera keyframe not found: ${keyframeId}`);
      const proposed = omitBoardCameraKeyframeChannels(key, channels);
      shot.cameraKeyframes =
        proposed === null
          ? shot.cameraKeyframes.filter((key) => key.id !== keyframeId)
          : shot.cameraKeyframes.map((key) => (key.id === keyframeId ? proposed : key));
    },
    { shotId },
  );
}
