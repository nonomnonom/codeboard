import type { Id, Transform } from "./primitives.js";

export interface TwoBoneRig {
  elbowId: Id;
  upperLength: number;
  lowerLength: number;
  restPose?: {
    root: { x: number; y: number; rotation: number };
    elbowRotation: number;
  };
}

export interface DrawingExposure {
  frame: number;
  drawingId: Id | null;
}

export interface DrawingInterval {
  startFrame: number;
  endFrame: number;
  drawingId: Id | null;
}

export interface DrawingNeighbors {
  current: DrawingInterval;
  previous: DrawingInterval | null;
  next: DrawingInterval | null;
}

export interface Transition {
  type: "cut" | "dissolve" | "wipe-left" | "wipe-right";
  durationFrames: number;
}

export type Easing =
  | "linear"
  | "ease-in-out"
  | "hold"
  | {
      type: "cubic-bezier";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    };

export type CameraChannel = "x" | "y" | "zoom" | "rotation";

export interface CameraKeyframe {
  id: Id;
  frame: number;
  x?: number;
  y?: number;
  zoom?: number;
  rotation?: number;
  easing: Easing;
  channelEasing?: Partial<Record<CameraChannel, Easing>>;
}

export type LayerEffectChannel = "offsetX" | "offsetY" | "opacity";
export interface LayerEffectValue {
  index: number;
  channel?: LayerEffectChannel;
  value: number;
  easing?: Easing;
}

export interface LayerKeyframe {
  effectValues?: LayerEffectValue[];
  id: Id;
  frame: number;
  transform: Partial<Transform>;
  opacity?: number;
  depth?: number;
  easing: Easing;
  channelEasing?: Partial<Record<LayerChannel, Easing>>;
}

export type LayerChannel = keyof Transform | "opacity" | "depth";

export type CameraKeyframeInput = Partial<Pick<CameraKeyframe, CameraChannel | "easing">>;
export type CameraKeyframeChanges = Partial<Omit<CameraKeyframe, "id">>;

export interface LayerKeyframeInput {
  effectValues?: LayerKeyframe["effectValues"];
  transform?: Partial<Transform>;
  opacity?: number;
  depth?: number;
  easing?: LayerKeyframe["easing"];
}

export type LayerKeyframeChanges = Partial<Omit<LayerKeyframe, "id">>;
