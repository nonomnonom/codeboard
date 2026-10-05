import type {
  LayerKeyframe,
  CameraKeyframe,
  LayerKeyframeInput,
  CameraKeyframeInput,
  Transform,
  LayerChannel,
  CameraChannel,
} from "../model/types.js";
import { layerKeyframeSchema, cameraKeyframeSchema } from "../model/schema/animation.js";

/** Merge authored channels without assigning identity or mutating the existing key. */
export function prepareBoardLayerKeyframe(
  frame: number,
  value: LayerKeyframeInput,
  existing?: LayerKeyframe,
) {
  const channelEasing = { ...existing?.channelEasing };
  if (existing && value.easing !== undefined) {
    for (const channel of Object.keys(value.transform ?? {}) as (keyof Transform)[])
      if (value.transform?.[channel] !== undefined) channelEasing[channel] = value.easing;
    if (value.opacity !== undefined) channelEasing.opacity = value.easing;
    if (value.depth !== undefined) channelEasing.depth = value.easing;
  }
  const keyframe = layerKeyframeSchema.parse({
    id: "",
    frame,
    transform: { ...existing?.transform, ...value.transform },
    opacity: value.opacity ?? existing?.opacity,
    depth: value.depth ?? existing?.depth,
    effectValues: value.effectValues ?? existing?.effectValues,
    easing: existing?.easing ?? value.easing ?? "linear",
    ...(Object.keys(channelEasing).length ? { channelEasing } : {}),
  });
  return keyframe;
}

/** Merge authored channels without assigning identity or mutating the existing key. */
export function prepareBoardCameraKeyframe(
  frame: number,
  value: CameraKeyframeInput,
  existing?: CameraKeyframe,
) {
  const channels = ["x", "y", "zoom", "rotation"] as const;
  if (!channels.some((channel) => value[channel] !== undefined))
    throw new Error("Camera keyframe must author at least one property");
  const supplied = Object.fromEntries(
    channels
      .filter((channel) => value[channel] !== undefined)
      .map((channel) => [channel, value[channel]]),
  );
  const channelEasing = { ...existing?.channelEasing };
  if (existing && value.easing !== undefined)
    for (const channel of channels)
      if (value[channel] !== undefined) channelEasing[channel] = value.easing;
  const keyframe = cameraKeyframeSchema.parse({
    ...existing,
    ...supplied,
    id: "",
    frame,
    easing: existing?.easing ?? value.easing ?? "linear",
    ...(Object.keys(channelEasing).length ? { channelEasing } : {}),
  });
  return keyframe;
}

/** Return a detached key, or null when its final authored channel is removed. */
export function omitBoardLayerKeyframeChannels(
  key: LayerKeyframe,
  channels: readonly LayerChannel[],
): LayerKeyframe | null {
  const keyframeId = key.id;
  const revised = structuredClone(key);
  for (const channel of channels) {
    if (
      (channel === "opacity" || channel === "depth"
        ? revised[channel]
        : revised.transform[channel]) === undefined
    )
      throw new Error(`Property ${channel} is not keyed at ${keyframeId}`);
    if (channel === "opacity" || channel === "depth") delete revised[channel];
    else delete revised.transform[channel];
    if (revised.channelEasing) delete revised.channelEasing[channel];
  }
  if (
    revised.opacity === undefined &&
    revised.depth === undefined &&
    !revised.effectValues?.length &&
    !Object.keys(revised.transform).length
  )
    return null;
  return layerKeyframeSchema.parse(revised);
}

/** Return a detached key, or null when its final authored channel is removed. */
export function omitBoardCameraKeyframeChannels(
  key: CameraKeyframe,
  channels: readonly CameraChannel[],
): CameraKeyframe | null {
  const keyframeId = key.id;
  const revised = structuredClone(key);
  for (const channel of channels) {
    if (revised[channel] === undefined)
      throw new Error(`Property ${channel} is not keyed at ${keyframeId}`);
    delete revised[channel];
    if (revised.channelEasing) delete revised.channelEasing[channel];
  }
  if (![revised.x, revised.y, revised.zoom, revised.rotation].some((value) => value !== undefined))
    return null;
  return cameraKeyframeSchema.parse(revised);
}
