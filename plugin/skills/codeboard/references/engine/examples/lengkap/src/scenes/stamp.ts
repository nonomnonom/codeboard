import type { StoryboardProject } from "codeboard-studio";
import {
  type Art,
  charcoal,
  dry,
  ink,
  paper,
  pastel,
  pencil,
  rough,
  stampPrint,
} from "../artwork/art.ts";
export function draw(a: Art, board: StoryboardProject): void {
  const page = a.group("Paper / impact response");
  const edge = a.layer("Report / cropped diagonal edges", page.id);
  a.stroke(
    edge,
    [
      [228, 770],
      [67, 160],
    ],
    24,
  );
  a.stroke(
    edge,
    [
      [73, 153],
      [910, -102],
    ],
    23,
  );
  a.stroke(
    edge,
    [
      [921, -18],
      [1265, 715],
    ],
    25,
  );
  a.stroke(
    edge,
    [
      [176, 743],
      [40, 285],
    ],
    10,
  );
  const rules = a.layer("Report / spare rules", page.id);
  a.stroke(
    rules,
    [
      [233, 181],
      [711, 66],
    ],
    8,
  );
  a.stroke(
    rules,
    [
      [267, 224],
      [751, 126],
    ],
    8,
  );
  a.stroke(
    rules,
    [
      [378, 609],
      [687, 533],
    ],
    9,
  );
  a.stroke(
    rules,
    [
      [397, 656],
      [725, 580],
    ],
    9,
  );
  const imprint = a.group("Cap / appears only at contact", 607, 351, 1.28, page.id);
  imprint.set({ transform: { x: 607, y: 351, scaleX: 1.28, scaleY: 1.28, rotation: -0.24 } });
  stampPrint(a, imprint.id);
  a.appear(imprint, 14);
  a.move(page, [
    [0, 0, 0],
    [13, 0, 0],
    [14, 0, 5],
    [17, 0, -2],
    [21, 0, 0],
  ]);
  const stamp = a.group("Stamp / handle and base", 607, 351, 1.28);
  const solid = a.layer("Stamp / two black masses", stamp.id);
  a.stroke(
    solid,
    [
      [0, -282],
      [0, -82],
    ],
    180,
    undefined,
    1,
    ink,
    rough,
  );
  a.stroke(
    solid,
    [
      [-70, -283],
      [-81, -171],
      [-72, -84],
    ],
    8,
  );
  a.stroke(
    solid,
    [
      [-263, 0],
      [263, 0],
    ],
    160,
    undefined,
    1,
    ink,
    dry,
  );
  a.stroke(
    solid,
    [
      [-262, 73],
      [270, 70],
    ],
    12,
  );
  const stampDetail = a.layer("Detail / stamp contour and worn ink strokes", stamp.id);
  a.stroke(
    stampDetail,
    [
      [-54, -315],
      [-73, -273],
      [-73, -215],
    ],
    5,
    undefined,
    6,
    ink,
    charcoal,
  );
  a.stroke(
    stampDetail,
    [
      [-39, -299],
      [-49, -265],
      [-48, -239],
    ],
    4,
    undefined,
    6,
    paper,
    pastel,
  );
  a.stroke(
    stampDetail,
    [
      [-216, 45],
      [-145, 48],
      [-94, 46],
    ],
    4.3,
    undefined,
    6,
    paper,
    pastel,
  );
  a.stroke(
    stampDetail,
    [
      [34, 56],
      [88, 57],
      [130, 54],
    ],
    2.3,
    undefined,
    6,
    paper,
    pencil,
  );
  a.stroke(
    stampDetail,
    [
      [-225, 84],
      [-115, 87],
      [-42, 84],
    ],
    3.2,
    undefined,
    6,
    ink,
    pencil,
  );
  for (const [f, x, y, r, s] of [
    [0, 730, -430, -0.24, 1.28],
    [8, 650, -50, -0.24, 1.28],
    [13, 610, 290, -0.24, 1.28],
    [14, 607, 351, -0.24, 1.28],
    [17, 607, 351, -0.24, 1.28],
    [25, 809, 171, 0.05, 1.0],
    [37, 1020, 620, 0.3, 0.85],
    [59, 1020, 620, 0.3, 0.85],
  ])
    board.production.addLayerKeyframe(stamp.id, 120 + f!, {
      transform: { x: x!, y: y!, rotation: r!, scaleX: s!, scaleY: s! },
      easing: "ease-in-out",
    });
}
