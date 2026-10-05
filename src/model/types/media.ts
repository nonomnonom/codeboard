import type { Id } from "./primitives.js";
import type { PageOptions } from "./query.js";

export interface Asset {
  id: Id;
  kind: "image" | "audio";
  name: string;
  path: string;
  mimeType: string;
  source: "linked" | "managed";
  checksum?: string;
}

export interface AudioClip {
  id: Id;
  assetId: Id;
  name: string;
  startFrame: number;
  sourceInFrame: number;
  durationFrames: number;
  volume: number;
  fadeInFrames: number;
  fadeOutFrames: number;
}

export interface AudioTrack {
  id: Id;
  name: string;
  muted: boolean;
  locked: boolean;
  clips: AudioClip[];
}

export interface AudioTrackSummary extends Omit<AudioTrack, "clips"> {
  clipCount: number;
}

export interface AudioClipQuery extends PageOptions {
  frame?: number;
  assetId?: Id;
}

export type AudioTrackChanges = Partial<Pick<AudioTrack, "name" | "muted" | "locked">>;
export type AudioClipInput = Omit<AudioClip, "id"> & { id?: Id };
export type AudioClipChanges = Partial<
  Pick<
    AudioClip,
    | "startFrame"
    | "sourceInFrame"
    | "durationFrames"
    | "volume"
    | "fadeInFrames"
    | "fadeOutFrames"
    | "name"
  >
>;
