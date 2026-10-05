import type { Id, Point } from "./primitives.js";
import type { Transition, CameraKeyframe } from "./animation.js";
import type { Layer } from "./layers.js";

export interface MotionAnnotation {
  id: Id;
  label: string;
  from: Point;
  to: Point;
  color: string;
}

export interface Panel {
  id: Id;
  shotId: Id;
  number: string;
  title: string;
  width: number;
  height: number;
  durationFrames: number;
  startFrame: number;
  transition: Transition;
  status: "working" | "review" | "approved";
  action: string;
  dialogue: string;
  camera: string;
  notes: string;
  layers: Layer[];
  motion: MotionAnnotation[];
  revision: number;
}

export interface Shot {
  id: Id;
  sceneId: Id;
  name: string;
  panelIds: Id[];
  cameraKeyframes: CameraKeyframe[];
}

export interface Scene {
  sequenceId: Id;
  id: Id;
  name: string;
  shotIds: Id[];
}

export interface Sequence {
  id: Id;
  name: string;
  sceneIds: Id[];
}

export interface PanelOptions {
  id?: Id;
  number?: string;
  title?: string;
  width?: number;
  height?: number;
  durationFrames?: number;
  action?: string;
  dialogue?: string;
  camera?: string;
  notes?: string;
}
