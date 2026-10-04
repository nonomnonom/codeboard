import type { Point } from "../model/types.js";
import {interpolateRotation,timedPoints} from "./pen-input.js";

type PointLike = Pick<Point, "x" | "y"> & Partial<Omit<Point, "x" | "y">>;

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function mixPoint(a: PointLike, b: PointLike, t: number): Point {
  const rotation=interpolateRotation(a.rotation,b.rotation,t);
  return {
    x: mix(a.x, b.x, t),
    y: mix(a.y, b.y, t),
    pressure: mix(a.pressure ?? 1, b.pressure ?? 1, t),
    time: mix(a.time ?? 0, b.time ?? 0, t),
    tiltX: mix(a.tiltX ?? 0, b.tiltX ?? 0, t),
    tiltY: mix(a.tiltY ?? 0, b.tiltY ?? 0, t),
    ...(rotation===undefined?{}:{rotation}),
  };
}

export function line(from: PointLike, to: PointLike, samples = 24): Point[] {
  if (!Number.isSafeInteger(samples)||samples < 2) throw new Error("line() requires a whole number of at least two samples");
  const [a,b]=timedPoints([from,to],(samples-1)*8);
  return Array.from({ length: samples }, (_, i) => mixPoint(a!, b!, i / (samples - 1)));
}

export function cubic(
  p0: PointLike,
  p1: PointLike,
  p2: PointLike,
  p3: PointLike,
  samples = 48,
): Point[] {
  if (!Number.isSafeInteger(samples)||samples < 2) throw new Error("cubic() requires a whole number of at least two samples");
  [p0,p1,p2,p3]=timedPoints([p0,p1,p2,p3],(samples-1)*8/3) as [Point,Point,Point,Point];
  return Array.from({ length: samples }, (_, i) => {
    const t = i / (samples - 1);
    const a = mixPoint(p0, p1, t);
    const b = mixPoint(p1, p2, t);
    const c = mixPoint(p2, p3, t);
    return mixPoint(mixPoint(a, b, t), mixPoint(b, c, t), t);
  });
}

export function catmullRom(points: PointLike[], samplesPerSegment = 12, tension = 0.5): Point[] {
  if (points.length < 2) throw new Error("catmullRom() requires at least two control points");
  if(!Number.isSafeInteger(samplesPerSegment)||samplesPerSegment<1)throw new Error("catmullRom() requires a positive whole sample count per segment");
  const explicitTime=points.some(p=>p.time!==undefined);
  points=timedPoints(points,samplesPerSegment*8);
  const result: Point[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    for (let step = 0; step < samplesPerSegment; step += 1) {
      const t = step / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const basis = (v0: number, v1: number, v2: number, v3: number) =>
        (2 * t3 - 3 * t2 + 1) * v1 + (t3 - 2 * t2 + t) * tension * (v2 - v0)
        + (-2 * t3 + 3 * t2) * v2 + (t3 - t2) * tension * (v3 - v1);
      result.push({
        ...mixPoint(p1,p2,t),
        x: basis(p0.x, p1.x, p2.x, p3.x),
        y: basis(p0.y, p1.y, p2.y, p3.y),
        pressure: Math.max(0, Math.min(1, basis(p0.pressure ?? 1, p1.pressure ?? 1, p2.pressure ?? 1, p3.pressure ?? 1))),
        time: explicitTime?mix(p1.time!,p2.time!,t):result.length*8,
      });
    }
  }
  result.push({ ...points.at(-1)!, time: explicitTime?points.at(-1)!.time!:result.length*8 });
  return result;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, options: { samples?: number; pressure?: number; rotation?: number } = {}): Point[] {
  const samples = options.samples ?? 64;
  const angle = options.rotation ?? 0;
  return Array.from({ length: samples + 1 }, (_, i) => {
    const theta = (i / samples) * Math.PI * 2;
    const x = Math.cos(theta) * rx;
    const y = Math.sin(theta) * ry;
    return {
      x: cx + x * Math.cos(angle) - y * Math.sin(angle),
      y: cy + x * Math.sin(angle) + y * Math.cos(angle),
      pressure: options.pressure ?? 1,
      time: i * 8,
    };
  });
}

export function translate(points: Point[], x: number, y: number): Point[] {
  return points.map((point) => ({ ...point, x: point.x + x, y: point.y + y }));
}

export function scale(points: Point[], scaleX: number, scaleY = scaleX, origin = { x: 0, y: 0 }): Point[] {
  return points.map((point) => ({
    ...point,
    x: origin.x + (point.x - origin.x) * scaleX,
    y: origin.y + (point.y - origin.y) * scaleY,
  }));
}

export function withPressure(points: Point[], pressure: number | ((t: number) => number)): Point[] {
  return points.map((point, index) => ({
    ...point,
    pressure: typeof pressure === "function" ? pressure(index / Math.max(1, points.length - 1)) : pressure,
  }));
}

export function hatchPolygon(
  polygon: PointLike[],
  options: { angle?: number; spacing?: number; pressure?: number; jitter?: number; seed?: number; maxSamples?:number } = {},
): Point[][] {
  if (polygon.length < 3) throw new Error("hatchPolygon() requires a polygon with at least three points");
  const angle = options.angle ?? -Math.PI / 4;
  const spacing = options.spacing ?? 10;
  if (!Number.isFinite(spacing) || spacing <= 0) throw new Error("Hatching spacing must be positive and finite");
  const maxSamples=options.maxSamples??1_000_000;
  if(!Number.isSafeInteger(maxSamples)||maxSamples<2)throw new Error("Hatching maxSamples must be a whole number of at least two");
  if(!Number.isFinite(angle)||!polygon.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))throw new Error("Hatching coordinates and angle must be finite");
  if(!Number.isFinite(options.pressure??.5)||(options.pressure??.5)<0||(options.pressure??.5)>1)throw new Error("Hatching pressure must be between zero and one");
  if(!Number.isFinite(options.jitter??0)||(options.jitter??0)<0)throw new Error("Hatching jitter must be nonnegative and finite");
  if(!Number.isSafeInteger(options.seed??1))throw new Error("Hatching seed must be a safe integer");
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const rotated = polygon.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }));
  let minY=Infinity,maxY=-Infinity;
  for(const p of rotated){
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new Error("Hatching rotated coordinates exceed the supported numerical range");
    minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
  }
  const rows=Math.floor((maxY-minY)/spacing)+1;
  if(!Number.isSafeInteger(rows)||rows>maxSamples)throw new Error(`Hatching scan rows exceed maxSamples ${maxSamples}; increase the explicit budget or spacing`);
  if(rows>1&&(minY+spacing===minY||maxY-spacing===maxY))throw new Error("Hatching spacing is below coordinate precision; translate the polygon closer to the origin");
  const lines: Point[][] = [];
  let state = options.seed ?? 1;
  const random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 0x100000000);
  let totalSamples=0;
  for (let row=0;row<rows;row++) {
    const y=minY+row*spacing;
    const intersections: number[] = [];
    for (let i = 0; i < rotated.length; i += 1) {
      const a = rotated[i]!;
      const b = rotated[(i + 1) % rotated.length]!;
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        const t=(y-a.y)/(b.y-a.y),x=(1-t)*a.x+t*b.x;
        if(!Number.isFinite(t)||!Number.isFinite(x))throw new Error("Hatching intersection exceeds the supported numerical range");
        intersections.push(x);
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const jitter = (random() - 0.5) * (options.jitter ?? 0);
      const a = { x: intersections[i]! + jitter, y };
      const b = { x: intersections[i + 1]! + jitter, y };
      const unrotate = (p: { x: number; y: number }): Point => ({
        x: p.x * cos + p.y * sin,
        y: -p.x * sin + p.y * cos,
        pressure: options.pressure ?? 0.5,
      });
      const samples=Math.max(2,Math.ceil((b.x-a.x)/8));
      totalSamples+=samples;
      if(!Number.isSafeInteger(totalSamples)||totalSamples>maxSamples)throw new Error(`Hatching samples exceed maxSamples ${maxSamples}; increase the explicit budget or spacing`);
      const from=unrotate(a),to=unrotate(b);
      if(![from.x,from.y,to.x,to.y].every(Number.isFinite))throw new Error("Hatching result exceeds the supported numerical range");
      lines.push(line(from,to,samples));
    }
  }
  return lines;
}

export function mirrored(points: Point[], axisX: number): Point[] {
  return points.map((point) => ({ ...point, x: axisX * 2 - point.x }));
}
