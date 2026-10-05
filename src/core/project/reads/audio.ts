import type { StoryboardDocument, Id, PageOptions, AudioClipQuery } from "../../../model/types.js";
import { pageBounds, boundQueryResponse } from "../../../model/query.js";
import { assertRenderFrame } from "../../../animation/frame.js";
import { findStudioAudioOwner } from "../../../model/studio.js";
import { CodeboardError } from "../../../model/errors.js";

export function readAudioTracks(document: StoryboardDocument, options: PageOptions) {
  const { offset, limit } = pageBounds(options);
  return boundQueryResponse(
    document.audioTracks
      .slice(offset, offset + limit)
      .map(({ clips, ...track }) => ({ ...track, clipCount: clips.length })),
  );
}

export function readAudioClips(document: StoryboardDocument, trackId: Id, options: AudioClipQuery) {
  const { offset, limit } = pageBounds(options);
  if (options.frame !== undefined) assertRenderFrame(options.frame);
  const track = document.audioTracks.find((track) => track.id === trackId);
  if (!track) throw new CodeboardError("INVALID_ARGUMENT", `Audio track not found: ${trackId}`);
  let skipped = 0;
  const result = [];
  for (const clip of track.clips) {
    if (options.assetId !== undefined && clip.assetId !== options.assetId) continue;
    if (
      options.frame !== undefined &&
      (options.frame < clip.startFrame || options.frame >= clip.startFrame + clip.durationFrames)
    )
      continue;
    if (skipped++ < offset) continue;
    result.push(clip);
    if (result.length === limit) break;
  }
  return structuredClone(boundQueryResponse(result));
}

export function readAudioClip(document: StoryboardDocument, id: Id) {
  for (const track of document.audioTracks) {
    const clip = track.clips.find((clip) => clip.id === id);
    if (clip) return { ...structuredClone(clip), trackId: track.id };
  }
  throw new CodeboardError("INVALID_ARGUMENT", `Audio clip not found: ${id}`);
}

export function readStudioAudioTracks(
  document: StoryboardDocument,
  ownerId: string,
  options: PageOptions,
) {
  const { offset, limit } = pageBounds(options);
  return boundQueryResponse(
    (findStudioAudioOwner(document, ownerId).audio ?? [])
      .slice(offset, offset + limit)
      .map(({ clips, ...track }) => ({ ...track, clipCount: clips.length })),
  );
}

export function readStudioAudioClips(
  document: StoryboardDocument,
  ownerId: string,
  trackId: string,
  options: PageOptions,
) {
  const { offset, limit } = pageBounds(options);
  const track = findStudioAudioOwner(document, ownerId).audio?.find((item) => item.id === trackId);
  if (!track)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      `Studio audio track not found in owner ${ownerId}: ${trackId}`,
    );
  return structuredClone(boundQueryResponse(track.clips.slice(offset, offset + limit)));
}
