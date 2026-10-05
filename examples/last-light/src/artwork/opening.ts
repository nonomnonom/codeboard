import type { PanelHandle, StoryboardProject } from "codeboard-studio";
import { city, contour, hatch, ink, stroke } from "./art.ts";
import { walkingPerformance } from "./walk.ts";
export function opening(p: PanelHandle, board: StoryboardProject, start: number, duration: number) {
  city(p);
  walkingPerformance(p, board, start, duration, 365, 379, 0.33, "Opening / crossing performance");
  const arcade = p.addVectorLayer("Opening / near arcade stone", { depth: 0.55 });
  contour(
    arcade,
    "M -140 -100 L 712 -100 C 426 -49 232 20 173 154 C 144 221 159 357 151 475 L 141 820 L -140 820 Z",
    ink,
  );
  contour(
    arcade,
    "M 52 -70 L 567 -70 C 313 -5 149 52 112 174 C 92 237 105 380 93 478 L 83 820 L 48 820 L 58 464 Q 72 283 59 161 C 90 55 206 -2 319 -45 Z",
    "#263236",
    ink,
    2,
  );
  stroke(
    arcade,
    [
      [482, -34],
      [330, 15],
      [214, 73],
      [161, 145],
      [148, 223],
      [151, 328],
    ],
    2,
    "#657468",
  );
  stroke(
    arcade,
    [
      [150, 356],
      [146, 445],
      [150, 478],
      [140, 566],
      [139, 665],
      [135, 741],
    ],
    2.5,
    "#53665d",
  );
  for (const d of [
    "M 58 239 L 144 257 L 154 276",
    "M 60 349 L 139 366 L 147 360",
    "M 48 465 L 135 475 L 150 489",
    "M 43 591 L 127 604 L 142 617",
    "M 36 717 L 122 730",
    "M 142 128 L 179 145",
    "M 219 40 L 233 64",
  ])
    contour(arcade, d, "transparent", "#4b5e58", 2);
  contour(
    arcade,
    "M 128 291 L 109 318 L 121 330 L 110 353 M 121 331 L 138 337",
    "transparent",
    "#819080",
    1.2,
  );
  hatch(
    arcade,
    [
      [117, 376],
      [139, 386],
      [133, 445],
      [111, 439],
    ],
    7,
    "#778270",
    -0.9,
    0.9,
  );
  const fixture = p.addVectorLayer("Opening / powerless hanging lamp", { depth: 0.7 });
  stroke(
    fixture,
    [
      [1136, -90],
      [1129, 73],
      [1131, 147],
    ],
    9,
    ink,
  );
  contour(
    fixture,
    "M 1097 176 L 1115 151 L 1145 151 L 1163 178 L 1179 187 L 1158 201 L 1091 200 L 1075 188 Z",
    ink,
  );
  contour(fixture, "M 1091 202 L 1159 203 L 1145 307 L 1105 307 Z", "#3c4846", ink, 4);
  contour(fixture, "M 1101 211 L 1121 212 L 1120 296 L 1112 290 Z", "#687266", "#687266", 0.7);
  for (const x of [1093, 1127, 1156])
    stroke(
      fixture,
      [
        [x, 202],
        [1127 + (x - 1127) * 0.6, 307],
      ],
      4,
      ink,
    );
  contour(
    fixture,
    "M 1100 302 L 1152 302 L 1149 313 L 1134 327 L 1129 344 L 1123 344 L 1118 327 L 1103 313 Z",
    ink,
  );
  stroke(
    fixture,
    [
      [1101, 184],
      [1126, 189],
      [1154, 185],
    ],
    1.3,
    "#67776a",
  );
}
