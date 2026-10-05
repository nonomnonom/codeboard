import type { XY, Art } from "./primitives.ts";
import { red, stampInk, pencil, pastel, paper } from "./palette.ts";
export const letters: Record<string, XY[][]> = {
  L: [
    [
      [0, 0],
      [0, 80],
      [43, 80],
    ],
  ],
  E: [
    [
      [46, 0],
      [0, 0],
      [0, 80],
      [48, 80],
    ],
    [
      [0, 38],
      [36, 38],
    ],
  ],
  N: [
    [
      [0, 80],
      [0, 0],
      [48, 80],
      [48, 0],
    ],
  ],
  G: [
    [
      [48, 10],
      [29, 1],
      [8, 12],
      [2, 42],
      [10, 72],
      [31, 79],
      [47, 68],
      [47, 44],
      [28, 44],
    ],
  ],
  K: [
    [
      [0, 0],
      [0, 80],
    ],
    [
      [46, 0],
      [0, 42],
      [48, 80],
    ],
  ],
  A: [
    [
      [0, 80],
      [24, 0],
      [49, 80],
    ],
    [
      [10, 53],
      [38, 53],
    ],
  ],
  P: [
    [
      [1, 80],
      [0, 0],
    ],
    [
      [0, 2],
      [29, 1],
      [46, 12],
      [47, 25],
      [34, 38],
      [1, 39],
    ],
  ],
};
export function stampPrint(a: Art, parent: string) {
  const l = a.layer("LENGKAP / rough red impression", parent);
  a.stroke(
    l,
    [
      [-280, -90],
      [-8, -94],
      [277, -90],
    ],
    13,
    undefined,
    1,
    red,
    stampInk,
  );
  a.stroke(
    l,
    [
      [273, -96],
      [278, 5],
      [275, 94],
    ],
    12,
    undefined,
    1,
    red,
    stampInk,
  );
  a.stroke(
    l,
    [
      [279, 94],
      [-1, 89],
      [-278, 94],
    ],
    14,
    undefined,
    1,
    red,
    stampInk,
  );
  a.stroke(
    l,
    [
      [-277, 95],
      [-281, 2],
      [-274, -95],
    ],
    12,
    undefined,
    1,
    red,
    stampInk,
  );
  a.stroke(
    l,
    [
      [-271, -82],
      [-269, 2],
      [-269, 81],
    ],
    3,
    undefined,
    1,
    red,
  );
  a.stroke(
    l,
    [
      [-263, -101],
      [-178, -103],
      [-141, -101],
    ],
    2.8,
    undefined,
    1,
    red,
    pencil,
  );
  a.stroke(
    l,
    [
      [129, 103],
      [216, 105],
      [274, 102],
    ],
    3.0,
    undefined,
    1,
    red,
    pastel,
  );
  a.stroke(
    l,
    [
      [-185, -91],
      [-169, -92],
    ],
    3.5,
    undefined,
    1,
    paper,
    pastel,
  );
  a.stroke(
    l,
    [
      [277, 41],
      [277, 56],
    ],
    3,
    undefined,
    1,
    paper,
    pastel,
  );
  let x = -233;
  for (const ch of "LENGKAP") {
    for (const path of letters[ch]!) {
      const coords = path.map(([px, py]) => [px + x + py * 0.06, py - 40 + Math.sin(x) * 3] as XY);
      if (ch === "G" || ch === "P") a.stroke(l, coords, 16, undefined, 1, red, stampInk);
      else a.corners(l, coords, 14, undefined, 1, red, stampInk);
    }
    x += 69;
  }
  return l;
}
