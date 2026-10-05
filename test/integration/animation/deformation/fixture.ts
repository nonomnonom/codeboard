import type { CurveMeshPose, EnvelopeMeshPose } from "../../../../src/index.js";

export const line = (x: number, y: number, dx: number, dy: number): CurveMeshPose["curve"] => [
  { x, y },
  { x: x + dx / 3, y: y + dy / 3 },
  { x: x + (2 * dx) / 3, y: y + (2 * dy) / 3 },
  { x: x + dx, y: y + dy },
];

export const ribbon: CurveMeshPose = { curve: line(0, 0, 0, 30), width: 8 };

export const envelope: EnvelopeMeshPose = {
  top: line(-4, 0, 8, 0),
  bottom: line(-4, 30, 8, 0),
  left: line(-4, 0, 0, 30),
  right: line(4, 0, 0, 30),
};

export const source = [
  { x: -4, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 30 },
  { x: -4, y: 30 },
];

export const triangles = [
  [0, 1, 2],
  [0, 2, 3],
] as const;
