import { catmullRom, ellipse, type LayerHandle, type Point } from "codeboard-studio";
import type { XY, Art } from "./primitives.ts";
import { ink, rough, dry, paper, pastel, pencil, fine } from "./palette.ts";
export const motorPaths: {
  xy: XY[];
  size: number;
}[] = [
  {
    xy: [
      [-62, -30],
      [-23, -30],
    ],
    size: 15,
  },
  {
    xy: [
      [-53, -18],
      [-24, -18],
      [-29, 0],
      [15, 0],
      [30, -37],
      [47, -10],
    ],
    size: 22,
  },
  {
    xy: [
      [46, 1],
      [33, -31],
      [24, -62],
      [8, -62],
    ],
    size: 10,
  },
  {
    xy: [
      [8, -53],
      [30, -56],
    ],
    size: 10,
  },
];
export function motor(
  a: Art,
  x: number,
  y: number,
  s: number,
  at?: number,
  span = 9,
  parent = a.root.id,
) {
  const g = a.group("Motor / consistent report pictogram", x, y, s, parent);
  const l = a.layer("Motor / two wheels and three gestures", g.id);
  for (const [i, cx] of [-55, 48].entries()) {
    const wheel = ellipse(cx, 6, 20, 20, { samples: 64 }).map((p, j) => ({
      ...p,
      x: p.x + Math.sin(j * 0.3) * 1.1,
      y: p.y + Math.sin(j * 0.42) * 0.8,
      pressure: 0.87 + 0.12 * Math.sin(j * 0.15),
    }));
    a.points(l, wheel, 15, at === undefined ? undefined : at + i * 2, Math.max(3, span - 4), ink, {
      ...rough,
      taperStart: 0,
      taperEnd: 0,
    });
    a.points(
      l,
      ellipse(cx, 6, 24, 23, { samples: 64 }),
      2,
      at === undefined ? undefined : at + i * 2,
      Math.max(3, span - 4),
      ink,
      dry,
    );
  }
  for (const [i, p] of motorPaths.entries())
    a.stroke(
      l,
      p.xy,
      p.size,
      at === undefined ? undefined : at + 2 + i,
      Math.max(3, span - 4),
      ink,
      dry,
    );
  const finish = a.layer("Detail / pictogram seat drag and wheel gestures", g.id);
  const f = at === undefined ? undefined : at + span - 3;
  a.stroke(
    finish,
    [
      [-64, -34],
      [-46, -35],
      [-26, -34],
    ],
    2.4,
    f,
    3,
    paper,
    pastel,
  );
  a.stroke(
    finish,
    [
      [-27, 7],
      [-7, 9],
      [12, 7],
    ],
    2.2,
    f,
    3,
    paper,
    pencil,
  );
  a.stroke(
    finish,
    [
      [-79, 4],
      [-74, 19],
      [-60, 30],
      [-44, 29],
    ],
    2.1,
    f,
    3,
    ink,
    pencil,
  );
  a.stroke(
    finish,
    [
      [28, 21],
      [39, 31],
      [54, 32],
      [68, 20],
    ],
    2.3,
    f,
    3,
    ink,
    pencil,
  );
  a.stroke(
    finish,
    [
      [25, -43],
      [30, -28],
      [34, -19],
    ],
    1.7,
    f,
    3,
    paper,
    fine,
  );
  return g;
}
export function dashed(a: Art, l: LayerHandle, points: Point[], width: number) {
  let distance = 0,
    segment: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    if (i) distance += Math.hypot(p.x - points[i - 1]!.x, p.y - points[i - 1]!.y);
    if (distance % 23 < 12) segment.push(p);
    else if (segment.length) {
      if (segment.length > 1) a.points(l, segment, width);
      segment = [];
    }
  }
  if (segment.length > 1) a.points(l, segment, width);
}
export function emptyMotor(a: Art, x: number, y: number, s = 1, parent = a.root.id) {
  const g = a.group("Unfilled place / dashed motor outline", x, y, s, parent),
    l = a.layer("Empty contour / no solid vehicle", g.id);
  const outline: XY[] = [
    [-80, 0],
    [-69, -30],
    [-27, -32],
    [-14, -21],
    [7, -23],
    [15, -42],
    [10, -59],
    [8, -66],
    [24, -72],
    [32, -59],
    [26, -51],
    [36, -35],
    [61, -20],
    [78, 2],
    [77, 26],
    [62, 37],
    [44, 32],
    [37, 22],
    [-23, 22],
    [-34, 36],
    [-55, 38],
    [-76, 27],
    [-80, 0],
  ];
  dashed(
    a,
    l,
    catmullRom(
      outline.map(([x, y]) => ({ x, y })),
      12,
    ),
    4.5,
  );
  return g;
}
