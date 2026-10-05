import { pathCommands, type LayerHandle, type PanelHandle } from "codeboard-studio";
import { ink, paper, grey, amber } from "./palette.ts";
import { contour, stroke, ring } from "./marks.ts";
export function mechanicalHead(
  layer: LayerHandle,
  lit: boolean,
  replace?: string[],
  part: "all" | "base" | "details" = "all",
) {
  const metal = lit ? "#bda36a" : "#919783",
    edge = lit ? "#edcb88" : "#c2c4a8";
  const shapes: [string, string, string, number, string][] = [
    [
      "M -12 -22 Q -10 -31 -3 -33 L 5 -32 Q 13 -28 13 -21 L 10 -14 L 3 -11 L -5 -12 L -11 -17 Z",
      metal,
      ink,
      1.25,
      "Firefly / head shell",
    ],
    [
      "M -11 -25 Q -7 -29 -3 -25 L -3 -19 Q -6 -16 -10 -19 Z",
      "#29373a",
      ink,
      0.75,
      "Firefly / left lens",
    ],
    ["M 5 -27 Q 10 -26 11 -22 L 8 -18 L 4 -20 Z", "#29373a", ink, 0.75, "Firefly / right lens"],
    [
      "M -3 -31 L 2 -31 L 3 -25 L 1 -18 L -2 -16 L -3 -24 Z",
      edge,
      ink,
      0.55,
      "Firefly / central ridge",
    ],
    [
      "M -9 -16 Q -2 -13 5 -15 L 8 -17 L 8 -14 L 3 -11 L -5 -12 Z",
      "#555f57",
      ink,
      0.45,
      "Firefly / underplate",
    ],
    ["M -10 -25 L -8 -27 L -6 -25 L -7 -23 Z", paper, paper, 0.2, "Firefly / lens reflection left"],
    ["M 6 -25 L 8 -24 L 9 -22 L 7 -22 Z", paper, paper, 0.2, "Firefly / lens reflection right"],
    ["M -9 -21 L -5 -22 M 6 -20 L 8 -22", "transparent", "#657b76", 0.45, "Firefly / lens etching"],
    [
      "M -8 -30 L -6 -32 L -3 -31 M 4 -30 L 7 -29 L 8 -27",
      "transparent",
      edge,
      0.7,
      "Firefly / shell edge",
    ],
    ["M -5 -16 L 3 -16 M -3 -14 L 2 -14", "transparent", ink, 0.6, "Firefly / neck vents"],
    ["M -8 -29 L -6 -31 L -4 -29 L -6 -27 Z", metal, ink, 0.55, "Firefly / antenna socket left"],
    ["M 6 -30 L 8 -31 L 10 -28 L 8 -26 Z", metal, ink, 0.55, "Firefly / antenna socket right"],
  ];
  for (const [index, [d, fill, stroke, strokeWidth, name]] of shapes.entries()) {
    if ((part === "base" && index >= 3) || (part === "details" && index < 3)) continue;
    const previous = replace?.[index];
    if (previous)
      layer.edit(previous, (element) => ({
        kind: "vector-path",
        id: element.id,
        name,
        commands: pathCommands(d),
        fill,
        stroke,
        strokeWidth,
        opacity: element.opacity,
        visible: element.visible,
      }));
    else contour(layer, d, fill, stroke, strokeWidth, name);
  }
}
export function mechanicalThoraxFinish(layer: LayerHandle, lit: boolean) {
  const light = lit ? "#ffe2a0" : "#c2c4a8",
    shadow = lit ? "#8b642d" : "#424e49";
  contour(
    layer,
    "M 11 -10 L 17 27 Q 14 41 2 54 L 7 39 Q 12 26 9 15 Z",
    shadow,
    shadow,
    0.3,
    "Thorax / rolled right wall",
  );
  contour(
    layer,
    "M -10 -10 Q -13 2 -15 20 L -12 28 Q -11 11 -7 -5 Z",
    light,
    light,
    0.3,
    "Thorax / shoulder reflection",
  );
  contour(
    layer,
    "M -14 33 Q -8 45 0 51 L -1 55 Q -12 45 -16 35 Z",
    shadow,
    shadow,
    0.3,
    "Thorax / lower plate bevel",
  );
  contour(
    layer,
    "M -10 37 Q -3 42 7 39 M -6 45 L -1 48",
    "transparent",
    light,
    0.75,
    "Thorax / plate rim highlights",
  );
  contour(
    layer,
    "M 12 2 L 14 8 M 13 13 L 15 18 M 13 25 L 14 28",
    "transparent",
    light,
    0.6,
    "Thorax / worn edge",
  );
}
export function insect(
  p: PanelHandle,
  x: number,
  y: number,
  s: number,
  spread = true,
  lit = true,
  parentId?: string,
) {
  const g = p.addGroup(
    "Mechanical firefly",
    { transform: { x, y, scaleX: s, scaleY: s } },
    parentId,
  );
  const wings = p.addVectorLayer("Etched brass wings", {}, g.id);
  if (spread) {
    const left = contour(
      wings,
      "M 0 0 C -35 -55 -133 -88 -154 -60 C -156 -30 -62 8 -5 10 Z",
      paper,
      ink,
      2,
      "notched-left-wing",
    );
    wings.booleanPath(
      left,
      pathCommands("M -164 -54 L -137 -53 L -142 -42 L -163 -36 Z"),
      "difference",
    );
    contour(wings, "M 3 -2 C 34 -52 113 -83 133 -52 C 136 -23 66 3 10 11 Z", paper, ink, 2);
    for (let i = 0; i < 6; i++) {
      stroke(
        wings,
        [
          [0, 3],
          [-47 - i * 16, -22 - i * 6],
          [-143 + i * 14, -61 + i * 4],
        ],
        1,
        grey,
      );
      stroke(
        wings,
        [
          [5, 4],
          [42 + i * 13, -20 - i * 4],
          [122 - i * 10, -54 + i * 3],
        ],
        1,
        grey,
      );
    }
  } else {
    const damaged = contour(
      wings,
      "M -3 -10 C -42 -53 -63 -71 -71 -54 Q -78 -31 -9 20 Z",
      paper,
      ink,
      1.5,
      "damaged-wing-contour",
    );
    wings.booleanPath(
      damaged,
      pathCommands("M -80 -37 L -53 -38 L -59 -23 L -80 -18 Z"),
      "difference",
    );
    contour(wings, "M 5 -10 C 32 -65 53 -72 54 -48 Q 51 -19 8 19 Z", paper);
    stroke(
      wings,
      [
        [-5, 3],
        [-29, -24],
        [-53, -48],
        [-65, -54],
      ],
      1.1,
      grey,
    );
    stroke(
      wings,
      [
        [-8, 9],
        [-30, -8],
        [-47, -23],
      ],
      0.8,
      grey,
    );
    stroke(
      wings,
      [
        [8, 5],
        [25, -22],
        [43, -51],
      ],
      1.1,
      grey,
    );
    stroke(
      wings,
      [
        [11, 10],
        [31, -8],
        [45, -33],
      ],
      0.8,
      grey,
    );
    for (const side of [-1, 1])
      stroke(
        wings,
        [
          [side * 8, 10],
          [side * 13, -2],
          [side * 20, -12],
        ],
        1.7,
        lit ? amber : "#929583",
      );
  }
  const body = p.addVectorLayer("Clockwork thorax", {}, g.id);
  contour(
    body,
    "M -12 -15 Q 0 -33 13 -15 L 19 30 Q 12 53 0 59 Q -16 48 -19 29 Z",
    lit ? amber : "#7c8274",
    ink,
    3,
  );
  for (let i = 0; i < 5; i++)
    stroke(
      body,
      [
        [-16, 6 + i * 8],
        [0, 12 + i * 8],
        [16, 6 + i * 8],
      ],
      1.3,
      ink,
    );
  const gear = p.addVectorLayer("Escapement / indexed wheel", { transform: { x: 0, y: 5 } }, g.id);
  ring(gear, 0, 0, 9, 9, ink, 1.3, paper);
  ring(gear, 0, 0, 3, 3, ink, 1, ink);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    stroke(
      gear,
      [
        [Math.cos(a) * 7, Math.sin(a) * 7],
        [Math.cos(a) * 11, Math.sin(a) * 11],
      ],
      1,
      ink,
    );
  }
  stroke(
    gear,
    [
      [2, -2],
      [6, -6],
    ],
    2,
    ink,
  );
  ring(body, 4, 24, 6, 6, ink, 1, paper);
  ring(body, 4, 24, 2, 2, ink, 1, ink);
  mechanicalHead(body, lit, undefined, "base");
  stroke(
    body,
    [
      [-6, -28],
      [-20, -41],
      [-25, -40],
    ],
    2,
    ink,
  );
  stroke(
    body,
    [
      [7, -28],
      [20, -43],
      [29, -43],
    ],
    2,
    ink,
  );
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++)
      stroke(
        body,
        [
          [side * 14, i * 9],
          [side * (25 + i * 4), i * 12 + 5],
          [side * (31 + i * 6), i * 12 + 18],
        ],
        1.5,
        ink,
      );
  mechanicalHead(body, lit, undefined, "details");
  mechanicalThoraxFinish(body, lit);
  return { group: g, wings, gear, body };
}
