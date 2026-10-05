import { pathCommands } from "codeboard-studio";
import type { Art } from "./primitives.ts";
import { ink, dry, pencil, paper, fine, rough, charcoal, pastel } from "./palette.ts";
export function person(
  a: Art,
  x: number,
  y: number,
  s: number,
  pose: "write" | "stand",
  at?: number,
) {
  const g = a.group(`Figure / ${pose}`, x, y, s);
  const bodyMask = a.panel.addVectorLayer(
    "Figure / editable body boundary",
    { visible: false },
    g.id,
  );
  bodyMask.path(
    pathCommands(
      pose === "write"
        ? "M -22 82 C -47 103 -91 142 -118 201 Q -128 222 -145 265 Q -59 264 -4 247 C 7 212 32 181 40 153 Q 37 117 18 93 Z"
        : "M -22 82 C -44 99 -94 140 -121 199 L -157 306 L 88 306 C 80 231 52 151 18 98 Z",
    ),
    { fill: ink },
  );
  const body = a.layer("Figure / overlapping torso sweeps", g.id);
  body.set({ maskLayerId: bodyMask.id });
  a.stroke(
    body,
    [
      [1, 102],
      [-59, 175],
      [-110, 278],
    ],
    143,
    at === undefined ? undefined : at + 5,
    11,
    ink,
    dry,
  );
  a.stroke(
    body,
    [
      [14, 129],
      [-4, 194],
      [24, 285],
    ],
    124,
    at === undefined ? undefined : at + 9,
    10,
    ink,
    dry,
  );
  const rim = a.layer("Figure / dry outer gestures", g.id);
  a.stroke(
    rim,
    [
      [-19, 92],
      [-65, 142],
      [-101, 190],
      [-141, 265],
    ],
    7,
    at === undefined ? undefined : at + 8,
    10,
  );
  a.stroke(
    rim,
    [
      [-24, 96],
      [-81, 151],
      [-124, 229],
    ],
    4.3,
    at === undefined ? undefined : at + 8,
    10,
    ink,
    pencil,
  );
  a.stroke(
    rim,
    [
      [-34, 117],
      [-53, 143],
      [-76, 174],
      [-90, 197],
    ],
    1.8,
    at === undefined ? undefined : at + 12,
    7,
    paper,
    fine,
  );
  a.stroke(
    rim,
    [
      [-97, 209],
      [-107, 229],
      [-116, 245],
    ],
    2.6,
    at === undefined ? undefined : at + 16,
    5,
    paper,
    fine,
  );
  const head = a.group("Figure / faceless oval", 0, 0, 1, g.id);
  const headMask = a.panel.addVectorLayer(
    "Head / editable oval boundary",
    { visible: false },
    head.id,
  );
  headMask.path(
    pathCommands(
      "M -24 91 C -43 71 -47 39 -32 14 C -18 -9 8 -17 29 -8 C 54 2 61 26 54 50 C 48 73 27 98 3 102 Q -15 106 -24 91 Z",
    ),
    { fill: ink },
  );
  const face = a.layer("Head / two broad ink sweeps", head.id);
  face.set({ maskLayerId: headMask.id });
  a.stroke(
    face,
    [
      [16, -10],
      [2, 48],
      [-12, 100],
    ],
    104,
    at,
    8,
    ink,
    dry,
  );
  a.stroke(
    face,
    [
      [28, -7],
      [28, 43],
      [6, 91],
    ],
    73,
    at === undefined ? undefined : at + 3,
    7,
    ink,
    dry,
  );
  const edge = a.layer("Head / rough perimeter", head.id);
  a.stroke(
    edge,
    [
      [-21, 91],
      [-42, 49],
      [-32, 14],
      [-10, -7],
      [20, -12],
      [47, 5],
      [59, 33],
      [49, 66],
      [6, 105],
    ],
    4,
    at,
    9,
    ink,
    pencil,
  );
  a.stroke(
    edge,
    [
      [-35, 12],
      [-18, -7],
      [17, -17],
      [40, -7],
    ],
    3,
    at,
    9,
    ink,
    pencil,
  );
  const arm = a.layer("Figure / arm gesture", g.id);
  if (pose === "write") {
    a.stroke(
      arm,
      [
        [24, 129],
        [49, 177],
        [90, 235],
      ],
      48,
      at === undefined ? undefined : at + 12,
      7,
      ink,
      dry,
    );
    a.stroke(
      arm,
      [
        [84, 234],
        [142, 230],
        [199, 216],
      ],
      39,
      at === undefined ? undefined : at + 17,
      7,
      ink,
      dry,
    );
    a.stroke(
      arm,
      [
        [193, 217],
        [208, 211],
      ],
      29,
      at === undefined ? undefined : at + 19,
      3,
      ink,
      rough,
    );
  } else
    a.stroke(
      arm,
      [
        [24, 132],
        [77, 205],
        [119, 293],
      ],
      29,
      at,
      12,
      ink,
      dry,
    );
  const finish = a.layer("Detail / charcoal shoulder and broken pastel drag", g.id);
  const f = at === undefined ? undefined : at + 21;
  a.stroke(
    finish,
    [
      [-41, 110],
      [-74, 143],
      [-104, 185],
    ],
    7,
    f,
    6,
    ink,
    charcoal,
  );
  a.stroke(
    finish,
    [
      [-66, 137],
      [-96, 175],
      [-121, 214],
    ],
    2.2,
    f,
    6,
    ink,
    pencil,
  );
  a.stroke(
    finish,
    [
      [-48, 136],
      [-61, 153],
      [-70, 169],
    ],
    3.6,
    f,
    5,
    paper,
    pastel,
  );
  a.stroke(
    finish,
    [
      [-80, 180],
      [-89, 193],
    ],
    4.4,
    f,
    4,
    paper,
    pastel,
  );
  a.stroke(
    finish,
    [
      [-109, 239],
      [-116, 255],
      [-123, 266],
    ],
    1.8,
    f,
    6,
    paper,
    pencil,
  );
  const headFinish = a.layer("Detail / graphite searching head contour", head.id);
  a.stroke(
    headFinish,
    [
      [-42, 48],
      [-44, 24],
      [-29, 0],
      [-8, -14],
    ],
    2.7,
    at === undefined ? undefined : at + 10,
    6,
    ink,
    pencil,
  );
  a.stroke(
    headFinish,
    [
      [51, 12],
      [57, 28],
      [54, 45],
    ],
    4.0,
    at === undefined ? undefined : at + 11,
    5,
    ink,
    charcoal,
  );
  a.stroke(
    headFinish,
    [
      [-18, 0],
      [-5, -5],
      [11, -6],
      [26, 0],
    ],
    2.6,
    at === undefined ? undefined : at + 12,
    5,
    paper,
    pastel,
  );
  a.stroke(
    headFinish,
    [
      [49, 51],
      [41, 70],
      [30, 82],
    ],
    1.7,
    at === undefined ? undefined : at + 13,
    5,
    paper,
    pencil,
  );
  if (pose === "write") {
    a.stroke(
      arm,
      [
        [44, 164],
        [62, 197],
        [81, 223],
      ],
      2.4,
      at === undefined ? undefined : at + 24,
      5,
      paper,
      pastel,
    );
    a.stroke(
      arm,
      [
        [106, 241],
        [148, 238],
        [176, 230],
      ],
      2.6,
      at === undefined ? undefined : at + 25,
      5,
      ink,
      pencil,
    );
  }
  return { g, head, arm };
}
