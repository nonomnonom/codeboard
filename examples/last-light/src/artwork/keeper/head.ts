import {
  catmullRom,
  pathCommands,
  samplePath,
  withPressure,
  type LayerHandle,
  type PanelHandle,
} from "codeboard-studio";
import { ink, paper, reed, dry } from "../palette.ts";
import { contour, stroke, ring, hatch } from "../marks.ts";
import type { KeeperPose } from "./types.ts";
export function head(p: PanelHandle, torso: LayerHandle, headAngle: number, pose: KeeperPose) {
  const head = p.addGroup(
    "Keeper / head and gaze",
    { pivot: { x: 140, y: 160 }, transform: { rotation: headAngle } },
    torso.id,
  );
  const l = p.addVectorLayer("Keeper / face, hair and hat", {}, head.id);
  const faceContour =
    "M 112 60 C 130 39 171 45 184 68 Q 183 81 180 91 C 182 98 188 103 193 108 Q 198 112 191 115 L 182 118 Q 180 121 181 125 L 178 128 Q 181 138 173 144 C 161 153 144 148 133 137 Q 123 128 123 116 L 111 98 Z";
  contour(l, faceContour, paper, ink, 0.75);
  contour(
    l,
    "M 140 66 Q 160 67 182 77 L 180 88 C 173 84 160 85 154 93 Q 150 100 148 107 L 141 117 Q 136 110 136 103 Z",
    "#a8ac98",
    "#a8ac98",
    0.5,
  );
  contour(
    l,
    "M 149 103 Q 163 110 176 106 Q 174 112 179 115 C 168 114 167 122 161 123 Q 152 122 147 115 Z",
    "#bcc0a9",
    "#bcc0a9",
    0.5,
  );
  contour(l, "M 178 94 Q 183 103 191 110 Q 185 113 182 110 L 181 105 Z", "#fff0d1", "#fff0d1", 0.5);
  contour(
    l,
    "M 112 65 Q 131 55 142 62 L 139 78 Q 136 84 137 89 L 133 86 L 134 94 L 130 98 L 129 109 L 131 119 L 128 115 L 130 133 L 117 119 L 110 92 Z",
    ink,
  );
  contour(
    l,
    "M 137 123 C 143 135 153 142 166 142 Q 174 141 178 134 Q 176 143 167 147 C 154 151 141 141 137 133 Z",
    "#aaaf98",
    "#aaaf98",
    0.4,
  );
  contour(
    l,
    "M 140 133 Q 150 143 163 145 Q 170 145 175 141 C 167 150 153 148 146 141 Z",
    "#85917c",
    "#85917c",
    0.3,
  );
  if (pose !== "watch")
    stroke(
      l,
      pose === "look-up"
        ? [
            [159, 83],
            [170, 81],
            [178, 85],
          ]
        : [
            [160, 85],
            [174, 88],
            [179, 92],
          ],
      3,
      ink,
    );
  if (pose === "look-up") {
    contour(l, "M 158 95 Q 166 89 176 93 Q 168 100 158 95 Z", paper, ink, 1);
    ring(l, 171, 94, 1.8, 2.2, ink, 1, ink);
  } else if (pose !== "watch")
    stroke(
      l,
      [
        [161, 96],
        [173, 96],
      ],
      2.4,
      ink,
    );
  stroke(
    l,
    [
      [183, 114],
      [178, 113],
    ],
    2,
    ink,
  );
  if (pose !== "watch")
    stroke(
      l,
      pose === "look-up"
        ? [
            [162, 128],
            [170, 128],
            [177, 124],
          ]
        : [
            [164, 126],
            [177, 125],
          ],
      2,
      ink,
    );
  stroke(
    l,
    [
      [142, 113],
      [146, 121],
    ],
    1.5,
    ink,
  );
  contour(
    l,
    "M 130 93 C 120 90 119 102 122 109 Q 125 116 130 111 L 135 102 Q 136 95 130 93 Z",
    "#b9bcaa",
    ink,
    1,
  );
  contour(
    l,
    "M 129 97 Q 123 96 125 104 L 128 102 Q 133 102 129 108",
    "transparent",
    "#636e60",
    1.1,
  );
  stroke(
    l,
    [
      [128, 108],
      [130, 107],
      [131, 103],
    ],
    1,
    ink,
  );
  stroke(
    l,
    [
      [150, 106],
      [158, 109],
      [167, 108],
    ],
    0.9,
    "#626e5e",
  );
  for (const [x, y] of [
    [147, 97],
    [150, 98],
    [153, 99],
  ])
    l.path(pathCommands(`M ${x} ${y} Q ${x! + 2} ${y! + 5} ${x! + 5} ${y! + 7}`), {
      stroke: "#8e9882",
      strokeWidth: 0.65,
    });
  l.path(pathCommands("M 172 112 Q 166 116 164 121 M 156 119 Q 158 122 161 124"), {
    stroke: "#7b8571",
    strokeWidth: 0.7,
  });
  hatch(
    l,
    [
      [145, 101],
      [154, 117],
      [170, 129],
      [155, 128],
      [139, 117],
    ],
    3,
    "#555e54",
    -0.9,
    0.7,
  );
  stroke(
    l,
    [
      [155, 78],
      [164, 75],
      [176, 80],
    ],
    1.1,
    ink,
  );
  if (pose !== "watch")
    stroke(
      l,
      [
        [162, 99],
        [169, 101],
        [173, 100],
      ],
      1,
      ink,
    );
  stroke(
    l,
    [
      [136, 119],
      [139, 130],
      [147, 137],
    ],
    1,
    ink,
  );
  for (const [x, y, dx, dy] of [
    [141, 128, 2, 4],
    [145, 130, 2, 4],
    [150, 133, 1.5, 4],
    [155, 135, 1, 4],
    [160, 136, 0.5, 3],
    [165, 135, 0, 3],
    [170, 133, -0.5, 3],
    [146, 124, 1.7, 3],
    [151, 127, 1.3, 3],
    [157, 130, 1, 3],
    [163, 131, 0.4, 3],
    [170, 130, 0, 2],
  ])
    stroke(
      l,
      [
        [x!, y!],
        [x! + dx! * 0.3, y! + dy! * 0.3],
        [x! + dx! * 0.6, y! + dy! * 0.6],
      ],
      0.55,
      "#536253",
    );
  for (const [x, y, dx, dy] of [
    [139, 121, 1.4, 1.8],
    [141, 125, 1.6, 2],
    [145, 128, 1.2, 1.7],
    [148, 131, 1.1, 1.7],
    [153, 131, 0.7, 1.8],
    [158, 134, 0.3, 1.8],
    [163, 135, 0, 1.6],
    [168, 135, -0.4, 1.7],
    [173, 132, -0.6, 1.5],
    [148, 126, 1, 1.4],
    [154, 129, 0.6, 1.6],
    [160, 131, 0.3, 1.4],
  ])
    l.path(
      pathCommands(`M ${x} ${y} Q ${x! + dx! * 0.2} ${y! + dy! * 0.6} ${x! + dx!} ${y! + dy!}`),
      { stroke: "#727e68", strokeWidth: 0.4 },
    );
  l.path(pathCommands("M 165 130 Q 170 132 175 130"), { stroke: "#8c947c", strokeWidth: 0.65 });
  contour(
    l,
    "M 83 68 L 100 31 Q 134 9 172 29 L 185 62 Q 210 72 215 84 C 172 90 132 74 94 78 L 67 78 Z",
    ink,
  );
  contour(l, "M 103 47 Q 139 38 178 53 L 182 64 Q 144 51 99 61 Z", "#737a71");
  hatch(
    l,
    [
      [103, 34],
      [119, 27],
      [115, 39],
      [100, 48],
    ],
    3,
    "#929b88",
    -0.85,
    0.7,
  );
  stroke(
    l,
    [
      [88, 72],
      [123, 65],
      [172, 74],
      [206, 80],
    ],
    2,
    paper,
  );
  stroke(
    l,
    [
      [110, 33],
      [137, 26],
      [159, 29],
    ],
    2,
    "#9da396",
  );
  const faceInk = p.addRasterLayer("Keeper / reed contour accents", {}, head.id);
  const contours = pathCommands(
    "M 180 91 C 182 98 188 103 193 108 Q 198 112 191 115 L 182 118 M 181 125 L 178 128 Q 181 138 173 144 C 161 153 144 148 133 137 Q 123 128 123 116",
  );
  for (const [index, points] of samplePath(contours, { step: 0.7 }).entries()) {
    faceInk.rasterStroke(
      withPressure(points, (t) => 0.18 + 0.82 * Math.sin(Math.PI * t) ** 0.7),
      { ...reed, size: index === 0 ? 2.1 : 2.8, flow: 0.85, taperStart: 0.1, taperEnd: 0.18 },
      { color: ink, seed: 4 },
    );
  }
  const faceMask = p.addVectorLayer("Keeper / face shading boundary", { visible: false }, head.id);
  contour(faceMask, faceContour, "#ffffff", "#ffffff", 0);
  const modelling = p.addRasterLayer(
    "Keeper / masked dry-brush form",
    { maskLayerId: faceMask.id, blendMode: "multiply", opacity: 0.5 },
    head.id,
  );
  for (const [index, points] of [
    [
      { x: 130, y: 116, pressure: 0.15 },
      { x: 135, y: 135, pressure: 0.7 },
      { x: 158, y: 149, pressure: 0.65 },
      { x: 184, y: 139, pressure: 0.1 },
    ],
    [
      { x: 138, y: 86, pressure: 0.12 },
      { x: 140, y: 103, pressure: 0.6 },
      { x: 148, y: 116, pressure: 0.4 },
      { x: 160, y: 120, pressure: 0.08 },
    ],
  ].entries())
    modelling.rasterStroke(
      catmullRom(points, 10),
      { ...dry, size: index === 0 ? 17 : 12, flow: 0.32, taperStart: 0.12, taperEnd: 0.22 },
      { color: "#576b5b", seed: 81 + index },
    );
}
