import type { Pivot, Id, BlendMode, Transform } from "./primitives.js";
import type { DrawingElement } from "./artwork.js";
import type { LayerKeyframe, DrawingExposure, TwoBoneRig } from "./animation.js";

export type LayerEffect =
  | { kind: "blur"; amount: number }
  | {
      kind: "shadow";
      amount: number;
      offsetX: number;
      offsetY: number;
      color: { r: number; g: number; b: number };
      opacity: number;
    }
  | { kind: "brightness"; amount: number }
  | { kind: "contrast"; amount: number }
  | { kind: "saturation"; amount: number }
  | { kind: "hue-rotate"; degrees: number };

interface LayerBase {
  effects?: LayerEffect[];
  pivot?: Pivot;
  componentSource?: { id: Id; version: number };
  id: Id;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  transform: Transform;
  maskLayerId?: Id;
  clipToBelow: boolean;
  keyframes: LayerKeyframe[];
  depth: number;
  exposure: { startFrame: number; endFrame: number } | null;
}

export interface DrawingLayer extends LayerBase {
  kind: "raster" | "vector";
  elements: DrawingElement[];
}

export interface GroupLayer extends LayerBase {
  kind: "group";
  children: Layer[];
  drawingSequence?: DrawingExposure[];
  twoBoneRig?: TwoBoneRig;
}

export type Layer = DrawingLayer | GroupLayer;

export type LayerChanges = Partial<
  Pick<
    Layer,
    "name" | "visible" | "opacity" | "blendMode" | "transform" | "clipToBelow" | "pivot" | "effects"
  >
> & { maskLayerId?: Id | null };

export interface DrawingComponent {
  id: Id;
  name: string;
  version: number;
  layers: Layer[];
}

export interface LayerOptions {
  effects?: LayerEffect[];
  pivot?: Pivot;
  depth?: number;
  exposure?: { startFrame: number; endFrame: number };
  id?: Id;
  opacity?: number;
  blendMode?: BlendMode;
  transform?: Partial<Transform>;
  maskLayerId?: Id;
  clipToBelow?: boolean;
  visible?: boolean;
}
