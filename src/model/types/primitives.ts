export type Id = string;

export type AffineMatrix = [number, number, number, number, number, number];

export interface Point {
  x: number;
  y: number;
  pressure?: number;
  time?: number;
  tiltX?: number;
  tiltY?: number;
  rotation?: number;
}

export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface Pivot {
  x: number;
  y: number;
}

export type BlendMode = "source-over" | "multiply" | "screen" | "overlay" | "darken" | "lighten";

export const identityTransform = (): Transform => ({
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
});
