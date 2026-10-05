import type { RationalRate } from "../../animation/rational-time.js";

export interface StudioAudioClip {
  id: string;
  assetId: string;
  name: string;
  start: { ticks: number; rate: RationalRate };
  source: { sampleRate: number; startSample: number; sampleCount: number };
  volume: number;
  fadeInSamples: number;
  fadeOutSamples: number;
}
export interface StudioAudioTrack {
  id: string;
  name: string;
  muted: boolean;
  clips: StudioAudioClip[];
}

export type StudioAudioEdit =
  | { op: "track.add"; track: StudioAudioTrack }
  | { op: "track.update"; id: string; changes: Partial<Pick<StudioAudioTrack, "name" | "muted">> }
  | { op: "track.remove"; id: string }
  | { op: "clip.add"; trackId: string; clip: StudioAudioClip }
  | { op: "clip.update"; id: string; changes: Partial<Omit<StudioAudioClip, "id">> }
  | { op: "clip.move"; id: string; trackId: string; start?: StudioAudioClip["start"] }
  | { op: "clip.split"; id: string; atSample: number; newId: string }
  | { op: "clip.remove"; id: string };
