import type { AudioTrackChanges, AudioClipInput, AudioClipChanges } from "../../model/types.js";
import type {
  AudioClip,
  AudioClipQuery,
  AudioTrackSummary,
  Id,
  PageOptions,
} from "../../model/types.js";
import {
  audioClipSchema,
  audioTrackChangesSchema,
  audioTrackSchema,
} from "../../model/schema/audio.js";
import { validateAudioFades } from "../../model/validation/audio.js";
import { prepareBoardAudioSplit } from "../../audio/board-clips.js";
import type { ProductionHost, MutationOptions } from "./host.js";

type Host = Pick<
  ProductionHost,
  "_applyProduction" | "_readAudioClip" | "_readAudioClips" | "_readAudioTracks"
>;

export function audioTracks(host: Host, options: PageOptions = {}): AudioTrackSummary[] {
  return host._readAudioTracks(options);
}

export function audioClips(host: Host, trackId: Id, options: AudioClipQuery = {}): AudioClip[] {
  return host._readAudioClips(trackId, options);
}

export function audioClip(host: Host, id: Id): AudioClip & { trackId: Id } {
  return host._readAudioClip(id);
}

export function addAudioTrack(
  host: Host,
  name: string,
  options: MutationOptions & { id?: Id } = {},
): Id {
  audioTrackSchema.parse({ id: options.id ?? "", name, muted: false, locked: false, clips: [] });
  let id = "";
  host._applyProduction(
    "add audio track",
    [],
    options.expectedVersion,
    (document, nextId) => {
      id = options.id ?? nextId("audio-track");
      document.audioTracks.push({ id, name, muted: false, locked: false, clips: [] });
    },
    { audio: true },
  );
  return id;
}

export function updateAudioTrack(
  host: Host,
  trackId: Id,
  changes: AudioTrackChanges,
  options: MutationOptions = {},
): void {
  const proposed = audioTrackChangesSchema.parse(changes);
  host._applyProduction(
    "update audio track",
    [trackId],
    options.expectedVersion,
    (d) => {
      const track = d.audioTracks.find((track) => track.id === trackId);
      if (!track) throw new Error(`Audio track not found: ${trackId}`);
      if (track.locked && (proposed.name !== undefined || proposed.muted !== undefined))
        throw new Error(`Unlock audio track before editing: ${trackId}`);
      for (const [key, value] of Object.entries(proposed))
        if (value !== undefined) Object.assign(track, { [key]: value });
    },
    { audio: true },
  );
}

export function removeAudioTrack(host: Host, trackId: Id, options: MutationOptions = {}): void {
  host._applyProduction(
    "remove audio track and clips",
    [trackId],
    options.expectedVersion,
    (d) => {
      const track = d.audioTracks.find((track) => track.id === trackId);
      if (!track) throw new Error(`Audio track not found: ${trackId}`);
      if (track.locked) throw new Error(`Audio track is locked: ${trackId}`);
      d.audioTracks = d.audioTracks.filter((track) => track.id !== trackId);
    },
    { audio: true },
  );
}

export function addAudioClip(
  host: Host,
  trackId: Id,
  clip: AudioClipInput,
  options: MutationOptions = {},
): Id {
  let id = "";
  host._applyProduction(
    "add audio clip",
    [trackId],
    options.expectedVersion,
    (document, nextId) => {
      const track = document.audioTracks.find((entry) => entry.id === trackId);
      if (!track) throw new Error(`Audio track not found: ${trackId}`);
      if (track.locked) throw new Error(`Audio track is locked: ${trackId}`);
      const asset = document.assets.find((entry) => entry.id === clip.assetId);
      if (asset?.kind !== "audio") throw new Error(`Audio asset not found: ${clip.assetId}`);
      const proposed = audioClipSchema.parse({ ...clip, id: clip.id ?? "new clip" });
      validateAudioFades(proposed);
      id = clip.id ?? nextId("audio-clip");
      track.clips.push({ ...proposed, id });
    },
    { audio: true },
  );
  return id;
}

export function updateAudioClip(
  host: Host,
  trackId: Id,
  clipId: Id,
  changes: AudioClipChanges,
  options: MutationOptions = {},
): void {
  host._applyProduction(
    "update audio clip",
    [trackId, clipId],
    options.expectedVersion,
    (document) => {
      const track = document.audioTracks.find((entry) => entry.id === trackId);
      if (!track) throw new Error(`Audio track not found: ${trackId}`);
      if (track.locked) throw new Error(`Audio track is locked: ${trackId}`);
      const clip = track.clips.find((entry) => entry.id === clipId);
      if (!clip) throw new Error(`Audio clip not found: ${clipId}`);
      const proposed = audioClipSchema.parse({
        ...clip,
        ...changes,
        id: clip.id,
        assetId: clip.assetId,
      });
      validateAudioFades(proposed);
      Object.assign(clip, proposed);
    },
    { audio: true },
  );
}

export function removeAudioClip(
  host: Host,
  trackId: Id,
  clipId: Id,
  options: MutationOptions = {},
) {
  host._applyProduction(
    "remove audio clip",
    [trackId, clipId],
    options.expectedVersion,
    (d) => {
      const track = d.audioTracks.find((t) => t.id === trackId);
      if (!track || track.locked) throw new Error("Missing or locked audio track");
      const index = track.clips.findIndex((c) => c.id === clipId);
      if (index < 0) throw new Error(`Audio clip not found: ${clipId}`);
      track.clips.splice(index, 1);
    },
    { audio: true },
  );
}

export function moveAudioClip(
  host: Host,
  clipId: Id,
  targetTrackId: Id,
  options: MutationOptions & { startFrame?: number } = {},
): void {
  const owner = host._readAudioClip(clipId).trackId;
  host._applyProduction(
    "move audio clip",
    [owner, targetTrackId, clipId],
    options.expectedVersion,
    (d) => {
      const source = d.audioTracks.find((track) => track.id === owner)!,
        target = d.audioTracks.find((track) => track.id === targetTrackId);
      if (!target) throw new Error(`Audio track not found: ${targetTrackId}`);
      if (source.locked || target.locked)
        throw new Error(`Audio track is locked: ${source.locked ? source.id : target.id}`);
      const index = source.clips.findIndex((clip) => clip.id === clipId),
        clip = source.clips[index]!;
      const proposed = audioClipSchema.parse({
        ...clip,
        startFrame: options.startFrame ?? clip.startFrame,
      });
      if (source === target) source.clips[index] = proposed;
      else {
        source.clips.splice(index, 1);
        target.clips.push(proposed);
      }
    },
    { audio: true },
  );
}

export function splitAudioClip(
  host: Host,
  clipId: Id,
  frame: number,
  options: MutationOptions = {},
): Id {
  if (!Number.isSafeInteger(frame) || frame < 0)
    throw new Error("Audio split frame must be a nonnegative safe integer");
  const owner = host._readAudioClip(clipId).trackId;
  let rightId = "";
  host._applyProduction(
    "split audio clip",
    [owner, clipId],
    options.expectedVersion,
    (document, nextId) => {
      const track = document.audioTracks.find((track) => track.id === owner)!;
      if (track.locked) throw new Error(`Audio track is locked: ${owner}`);
      const index = track.clips.findIndex((clip) => clip.id === clipId),
        clip = track.clips[index]!;
      const { left, right } = prepareBoardAudioSplit(clip, frame);
      rightId = nextId("audio-clip");
      right.id = rightId;
      track.clips.splice(index, 1, left, right);
    },
    { audio: true },
  );
  return rightId;
}
