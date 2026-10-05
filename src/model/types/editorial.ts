import type { StudioAudioTrack } from "./studio-audio.js";
import type { Transition } from "./animation.js";
import type { RationalRate } from "../../animation/rational-time.js";
export type { ShotAnimation, ShotAnimationEdit } from "./shot.js";
export type { StudioContent } from "./studio.js";

export interface EditorialClip {
  id: string;
  animationId: string;
  startFrame: number;
  sourceInFrame: number;
  /** Editorial frames to hold source-in before normal source playback; shot audio is silent during the hold. */
  holdFrames?: number;
  durationFrames: number;
  transition: Transition;
}

export interface EditorialSequence {
  audio?: StudioAudioTrack[];
  id: string;
  frameRate: RationalRate;
  clips: EditorialClip[];
}

export interface ResolvedEditorialFrame {
  frame: number;
  outgoing: { clipId: string; animationId: string; sourceFrame: number };
  incoming?: { clipId: string; animationId: string; sourceFrame: number };
  transition: Transition["type"];
  progress: number;
}

export type EditorialEdit =
  | { op: "split"; id: string; atFrame: number; newId: string }
  | { op: "insert"; clip: Omit<EditorialClip, "startFrame">; beforeId?: string }
  | {
      op: "update";
      id: string;
      changes: Partial<
        Pick<
          EditorialClip,
          "animationId" | "sourceInFrame" | "holdFrames" | "durationFrames" | "transition"
        >
      >;
    }
  | { op: "move"; id: string; beforeId?: string }
  | { op: "remove"; id: string };
