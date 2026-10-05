import { Path2D, type CanvasRenderingContext2D } from "skia-canvas";
import type { Point, VectorStroke, VectorPath } from "../model/types.js";
import { taper } from "../render/brush-engine.js";
import { pathCommands } from "./path.js";

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function vectorWidth(stroke: VectorStroke, point: Point, progress: number): number {
  const pressure = clamp(point.pressure ?? 1);
  return Math.max(
    0.2,
    stroke.width *
      (1 - stroke.pressureSize + pressure * stroke.pressureSize) *
      taper(progress, stroke.taperStart, stroke.taperEnd),
  );
}

export function traceVectorStroke(
  ctx: Path2D | CanvasRenderingContext2D,
  stroke: VectorStroke,
): void {
  if (!stroke.points.length) return;
  const points: Point[] = [];
  for (const point of stroke.points) {
    const previous = points.at(-1);
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) <= 1e-6) {
      if ((point.pressure ?? 1) > (previous.pressure ?? 1))
        points[points.length - 1] = { ...previous, pressure: point.pressure ?? 1 };
    } else points.push(point);
  }
  if (points.length === 1) {
    const width = vectorWidth(stroke, points[0]!, 0.5);
    ctx.arc(points[0]!.x, points[0]!.y, width / 2, 0, Math.PI * 2);
  } else {
    const edges = points.map((p, i) => {
      const previous = points[Math.max(0, i - 1)]!,
        next = points[Math.min(points.length - 1, i + 1)]!;
      const angle = Math.atan2(next.y - previous.y, next.x - previous.x),
        radius = vectorWidth(stroke, p, i / (points.length - 1)) / 2;
      return { p, angle, radius, x: -Math.sin(angle) * radius, y: Math.cos(angle) * radius };
    });
    const first = edges[0]!,
      last = edges.at(-1)!;
    ctx.moveTo(first.p.x + first.x, first.p.y + first.y);
    for (const e of edges.slice(1)) ctx.lineTo(e.p.x + e.x, e.p.y + e.y);
    ctx.arc(
      last.p.x,
      last.p.y,
      last.radius,
      last.angle + Math.PI / 2,
      last.angle - Math.PI / 2,
      true,
    );
    for (const e of [...edges].reverse()) ctx.lineTo(e.p.x - e.x, e.p.y - e.y);
    ctx.arc(
      first.p.x,
      first.p.y,
      first.radius,
      first.angle - Math.PI / 2,
      first.angle + Math.PI / 2,
      true,
    );
    ctx.closePath();
  }
}

export function outlinedStroke(stroke: VectorStroke): VectorPath {
  if (stroke.closed && stroke.fill !== undefined)
    throw new Error(
      "Outline conversion requires a stroke without a closed-area fill; separate the fill first",
    );
  const path = new Path2D();
  traceVectorStroke(path, stroke);
  path.closePath();
  const { id, name, matrix, visible, opacity, color } = stroke;
  return {
    id,
    kind: "vector-path",
    commands: path.d ? pathCommands(path.d) : [],
    fill: color,
    ...(stroke.colorBindings?.color
      ? { colorBindings: { fill: structuredClone(stroke.colorBindings.color) } }
      : {}),
    strokeWidth: 0,
    visible,
    opacity,
    ...(name !== undefined ? { name } : {}),
    ...(matrix ? { matrix: [...matrix] } : {}),
  };
}
