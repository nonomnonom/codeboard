import type { Art } from "./primitives.ts";
import { ink, pencil, charcoal, paper, pastel } from "./palette.ts";
export function document(
  a: Art,
  x: number,
  y: number,
  w: number,
  h: number,
  at?: number,
  parent = a.root.id,
  heading = true,
) {
  const l = a.layer("Report / paper perimeter", parent);
  a.stroke(
    l,
    [
      [x - 4, y + h + 5],
      [x - 10, y + h * 0.52],
      [x + 1, y + 6],
    ],
    13,
    at,
    7,
  );
  a.stroke(
    l,
    [
      [x + 7, y],
      [x + w * 0.45, y - 7],
      [x + w + 2, y - 3],
    ],
    11,
    at === undefined ? undefined : at + 4,
    5,
  );
  a.stroke(
    l,
    [
      [x + w + 1, y + 2],
      [x + w + 7, y + h * 0.55],
      [x + w + 3, y + h],
    ],
    12,
    at === undefined ? undefined : at + 6,
    8,
  );
  a.stroke(
    l,
    [
      [x + w + 2, y + h],
      [x + w * 0.52, y + h + 3],
      [x - 3, y + h - 2],
    ],
    10,
    at === undefined ? undefined : at + 11,
    4,
  );
  a.stroke(
    l,
    [
      [x - 15, y + h * 0.84],
      [x - 19, y + h * 0.47],
      [x - 12, y + 34],
    ],
    3.4,
    at === undefined ? undefined : at + 4,
    9,
    ink,
    pencil,
  );
  const finish = a.layer("Detail / paper corners and graphite edge", parent);
  const f = at === undefined ? undefined : at + 12;
  a.stroke(
    finish,
    [
      [x - 16, y + 75],
      [x - 17, y + 12],
      [x + 18, y - 10],
      [x + 83, y - 13],
    ],
    2.4,
    f,
    5,
    ink,
    pencil,
  );
  a.stroke(
    finish,
    [
      [x + w + 13, y + h - 104],
      [x + w + 15, y + h + 8],
      [x + w - 51, y + h + 12],
    ],
    2.7,
    f,
    6,
    ink,
    pencil,
  );
  a.stroke(
    finish,
    [
      [x + w + 2, y + 43],
      [x + w + 5, y + 89],
      [x + w + 6, y + 138],
    ],
    5.5,
    f,
    5,
    ink,
    charcoal,
  );
  a.stroke(
    finish,
    [
      [x + 23, y - 2],
      [x + 54, y - 3],
      [x + 103, y - 5],
    ],
    3.5,
    f,
    4,
    paper,
    pastel,
  );
  a.stroke(
    finish,
    [
      [x + w + 5, y + h - 54],
      [x + w + 4, y + h - 19],
    ],
    3.6,
    f,
    5,
    paper,
    pastel,
  );
  if (heading) {
    const label = a.text(
      "Report / LAPORAN",
      "LAPORAN",
      x + 45,
      y + 96,
      'bold 39px "Segoe Print"',
      parent,
    );
    if (at !== undefined) a.appear(label, at + 10);
  }
  return l;
}
