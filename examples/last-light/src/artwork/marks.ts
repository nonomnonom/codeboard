import {
  catmullRom,
  ellipse,
  hatchPolygon,
  pathCommands,
  type LayerHandle,
} from "codeboard-studio";
import { ink } from "./palette.ts";
export function contour(
  l: LayerHandle,
  d: string,
  fill = ink,
  stroke = ink,
  width = 1.5,
  name?: string,
) {
  return l.path(pathCommands(d), { fill, stroke, strokeWidth: width, ...(name ? { name } : {}) });
}
export function stroke(l: LayerHandle, xy: number[][], width = 2, color = ink, pressure = 0.75) {
  return l.vectorStroke(
    catmullRom(
      xy.map(([x, y], i) => ({
        x: x!,
        y: y!,
        pressure: pressure * (0.65 + 0.35 * Math.sin((i + 1) * 1.4)),
      })),
      6,
    ),
    { width, color, taperStart: 0.06, taperEnd: 0.18 },
  );
}
export function ring(
  l: LayerHandle,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color = ink,
  width = 2,
  fill?: string,
) {
  l.vectorStroke(ellipse(x, y, rx, ry, { samples: 36 }), {
    color,
    width,
    closed: true,
    ...(fill ? { fill } : {}),
  });
}
export function hatch(
  l: LayerHandle,
  polygon: number[][],
  spacing = 7,
  color = ink,
  angle = -0.8,
  width = 1,
) {
  for (const points of hatchPolygon(
    polygon.map(([x, y]) => ({ x: x!, y: y! })),
    { spacing, angle },
  ))
    l.vectorStroke(points, {
      color,
      width,
      pressureSize: 0.3,
      taperStart: 0.1,
      taperEnd: 0.15,
      opacity: 0.65,
    });
}
