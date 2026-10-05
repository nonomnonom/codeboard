import type { StoryboardProject } from "codeboard-studio";
import { type Art, document, dry, fine, ink, paper, person } from "../artwork/art.ts";
export function draw(a: Art, _board: StoryboardProject): void {
  const desk = a.layer("Table / broad overlapping sweeps");
  a.stroke(
    desk,
    [
      [12, 636],
      [549, 674],
      [1257, 594],
    ],
    68,
    2,
    12,
  );
  a.stroke(
    desk,
    [
      [42, 665],
      [563, 701],
      [1206, 641],
    ],
    36,
    8,
    9,
  );
  a.stroke(
    desk,
    [
      [59, 622],
      [614, 578],
      [1241, 560],
    ],
    13,
    7,
    9,
  );
  a.stroke(
    desk,
    [
      [116, 642],
      [208, 653],
      [318, 663],
    ],
    2.4,
    8,
    5,
    paper,
    fine,
  );
  a.stroke(
    desk,
    [
      [398, 683],
      [487, 688],
      [605, 686],
      [690, 680],
    ],
    2.8,
    12,
    6,
    paper,
    fine,
  );
  a.stroke(
    desk,
    [
      [1010, 641],
      [1081, 628],
      [1160, 612],
    ],
    1.8,
    13,
    5,
    paper,
    fine,
  );
  const figure = person(a, 367, 196, 1.58, "write", 7);
  a.move(figure.arm, [
    [0, 0, 0],
    [30, 0, 0],
    [36, 6, -4],
    [41, 0, 0],
    [47, 5, -3],
    [53, 0, 0],
  ]);
  document(a, 640, 85, 355, 476, 20);
  const pen = a.layer("Pen / simple nib");
  a.stroke(
    pen,
    [
      [700, 583],
      [653, 510],
      [617, 453],
    ],
    16,
    28,
    5,
    ink,
    dry,
  );
  a.move(pen, [
    [0, 0, 0],
    [30, 0, 0],
    [36, 6, -4],
    [41, 0, 0],
    [47, 5, -3],
    [53, 0, 0],
  ]);
  const marks = a.layer("Report / two written lines");
  a.stroke(
    marks,
    [
      [700, 433],
      [910, 424],
    ],
    9,
    35,
    7,
  );
  a.stroke(
    marks,
    [
      [700, 470],
      [928, 464],
    ],
    9,
    45,
    7,
  );
}
