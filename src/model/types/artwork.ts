import type { AffineMatrix, Id, Point } from "./primitives.js";
import type { BrushPreset } from "./brushes.js";
import type { ColorBinding, ColorChannel } from "./palettes.js";
import type { Scene3DElement } from "./scene3d.js";

interface ElementPlacement {
  matrix?: AffineMatrix;
  colorBindings?: Partial<Record<ColorChannel, ColorBinding>>;
}

export interface RasterStroke extends ElementPlacement {
  /** Owner time domain (board global or shot local): blank at startFrame, complete at endFrame. */
  reveal?: { startFrame: number; endFrame: number };
  kind: "raster-stroke";
  id: Id;
  name?: string;
  points: Point[];
  brush: BrushPreset;
  color: string;
  opacity: number;
  erase: boolean;
  seed: number;
  visible: boolean;
}

export interface PixelBuffer {
  width: number;
  height: number;
  pixels: Uint8Array;
}

export interface PixelSelection {
  width: number;
  height: number;
  coverage: Uint8Array;
}

export interface PixelRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Straight-alpha, sRGB RGBA8 pixels; matrix maps source pixels into layer coordinates. */
export interface RasterSurface extends PixelBuffer, ElementPlacement {
  kind: "raster-surface";
  id: Id;
  name?: string;
  matrix: AffineMatrix;
  opacity: number;
  visible: boolean;
}

export interface VectorStroke extends ElementPlacement {
  kind: "vector-stroke";
  id: Id;
  name?: string;
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  taperStart: number;
  taperEnd: number;
  pressureSize: number;
  closed: boolean;
  fill?: string;
  visible: boolean;
}

export type VectorFill =
  | string
  | {
      kind: "linear";
      from: { x: number; y: number };
      to: { x: number; y: number };
      stops: { offset: number; color: string }[];
    }
  | {
      kind: "radial";
      from: { x: number; y: number; radius: number };
      to: { x: number; y: number; radius: number };
      stops: { offset: number; color: string }[];
    };

export interface VectorPath extends ElementPlacement {
  kind: "vector-path";
  id: Id;
  name?: string;
  commands: PathCommand[];
  fill?: VectorFill;
  stroke?: string;
  strokeWidth: number;
  opacity: number;
  visible: boolean;
}

export interface TextElement extends ElementPlacement {
  kind: "text";
  id: Id;
  name?: string;
  x: number;
  y: number;
  text: string;
  color: string;
  font: string;
  align: "left" | "center" | "right";
  opacity: number;
  visible: boolean;
}

export type PathCommand =
  | { op: "M" | "L"; x: number; y: number }
  | { op: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { op: "Q"; x1: number; y1: number; x: number; y: number }
  | { op: "Z" };

export type DrawingElement =
  | RasterStroke
  | RasterSurface
  | VectorStroke
  | VectorPath
  | TextElement
  | Scene3DElement;

export type NewDrawingElement =
  | (Omit<Scene3DElement, "id"> & { id?: Id })
  | (Omit<RasterStroke, "id"> & { id?: Id })
  | (Omit<RasterSurface, "id"> & { id?: Id })
  | (Omit<VectorStroke, "id"> & { id?: Id })
  | (Omit<VectorPath, "id"> & { id?: Id })
  | (Omit<TextElement, "id"> & { id?: Id });

export interface StrokeOptions {
  reveal?: { startFrame: number; endFrame: number };
  id?: Id;
  name?: string;
  color?: string;
  opacity?: number;
  erase?: boolean;
  seed?: number;
}

export interface VectorStrokeOptions extends StrokeOptions {
  width?: number;
  taperStart?: number;
  taperEnd?: number;
  pressureSize?: number;
  closed?: boolean;
  fill?: string;
}
