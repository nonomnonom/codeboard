import type { StoryboardProject } from "codeboard-studio";
import {
  type Art,
  charcoal,
  dry,
  ink,
  paper,
  pastel,
  pencil,
  person,
  red,
} from "../artwork/art.ts";
export function draw(a: Art, _board: StoryboardProject): void {
  person(a, 248, 128, 2.53, "stand");
  const remnant = a.layer("Warehouse / cropped lower right");
  a.stroke(
    remnant,
    [
      [716, 578],
      [1012, 529],
      [1295, 488],
    ],
    28,
  );
  a.stroke(
    remnant,
    [
      [776, 576],
      [774, 633],
    ],
    13,
  );
  a.stroke(
    remnant,
    [
      [1199, 510],
      [1200, 633],
    ],
    13,
  );
  a.stroke(
    remnant,
    [
      [463, 647],
      [900, 629],
      [1299, 642],
    ],
    13,
  );
  const closingDetail = a.layer("Detail / closing roof and graphite ground");
  a.stroke(
    closingDetail,
    [
      [742, 590],
      [826, 576],
      [892, 562],
    ],
    2.3,
    undefined,
    6,
    ink,
    pencil,
  );
  a.stroke(
    closingDetail,
    [
      [748, 575],
      [799, 567],
      [829, 562],
    ],
    2.5,
    undefined,
    6,
    paper,
    pastel,
  );
  a.stroke(
    closingDetail,
    [
      [751, 638],
      [778, 640],
      [806, 637],
    ],
    4.7,
    undefined,
    6,
    ink,
    charcoal,
  );
  a.stroke(
    closingDetail,
    [
      [951, 645],
      [1057, 651],
      [1148, 649],
    ],
    2.1,
    undefined,
    6,
    ink,
    pencil,
  );
  const words = a.group("Closing / handwritten phrase", 0, 0);
  words.set({ transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: -0.055 } });
  a.text("Closing / line one", "Di kertas,", 620, 262, 'bold 58px "Segoe Print"', words.id);
  a.text("Closing / line two", "semuanya ada.", 634, 345, 'bold 58px "Segoe Print"', words.id);
  const underline = a.layer("Closing / red underline");
  a.stroke(
    underline,
    [
      [650, 422],
      [826, 370],
      [1176, 321],
    ],
    23,
    4,
    7,
    red,
    dry,
  );
}
