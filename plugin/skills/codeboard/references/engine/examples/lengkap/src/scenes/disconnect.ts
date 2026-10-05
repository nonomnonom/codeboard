import type { StoryboardProject } from "codeboard-studio";
import {
  type Art,
  charcoal,
  document,
  dry,
  emptyMotor,
  ink,
  motor,
  paper,
  pastel,
  pencil,
  red,
} from "../artwork/art.ts";
export function draw(a: Art, _board: StoryboardProject): void {
  const crop = a.group("Report / cropped paper", -1, 173);
  crop.set({ transform: { x: -1, y: 173, scaleX: 1, scaleY: 1, rotation: -0.18 } });
  document(a, 50, 0, 408, 565, undefined, crop.id, false);
  motor(a, 255, 207, 1.49, undefined, 9, crop.id);
  const rules = a.layer("Report / two lines", crop.id);
  a.stroke(
    rules,
    [
      [104, 323],
      [355, 322],
    ],
    10,
  );
  a.stroke(
    rules,
    [
      [109, 370],
      [337, 369],
    ],
    10,
  );
  const fragment = a.layer("Warehouse / right edge");
  a.stroke(
    fragment,
    [
      [781, 84],
      [1059, 30],
      [1309, 5],
    ],
    59,
  );
  a.stroke(
    fragment,
    [
      [852, 82],
      [848, 299],
      [845, 566],
    ],
    17,
  );
  a.stroke(
    fragment,
    [
      [636, 583],
      [972, 591],
      [1256, 622],
    ],
    13,
  );
  const groundDetail = a.layer("Detail / empty warehouse ground gestures");
  a.stroke(
    groundDetail,
    [
      [824, 594],
      [853, 596],
      [883, 598],
    ],
    5,
    undefined,
    6,
    ink,
    charcoal,
  );
  a.stroke(
    groundDetail,
    [
      [913, 608],
      [1002, 615],
      [1056, 618],
    ],
    2.5,
    undefined,
    6,
    ink,
    pencil,
  );
  a.stroke(
    groundDetail,
    [
      [824, 73],
      [873, 63],
      [930, 52],
    ],
    3,
    undefined,
    6,
    paper,
    pastel,
  );
  emptyMotor(a, 1045, 519, 2.05);
  const link = a.layer("Red / interrupted connection");
  a.stroke(
    link,
    [
      [414, 341],
      [475, 354],
      [535, 357],
    ],
    11,
    6,
    12,
    red,
    dry,
  );
  a.stroke(
    link,
    [
      [736, 390],
      [828, 444],
    ],
    11,
    19,
    3,
    red,
    dry,
  );
  const cross = a.layer("Red / two decisive X strokes");
  a.stroke(
    cross,
    [
      [600, 279],
      [723, 433],
    ],
    28,
    24,
    4,
    red,
    dry,
  );
  a.stroke(
    cross,
    [
      [735, 272],
      [598, 440],
    ],
    28,
    30,
    4,
    red,
    dry,
  );
}
