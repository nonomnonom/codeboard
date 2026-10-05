import type { Art } from "./primitives.ts";
import { paper, fine, ink, pencil, charcoal, pastel, dry } from "./palette.ts";
export function warehouse(a: Art, parent = a.root.id) {
  const l = a.layer("Warehouse / roof, two posts, floor", parent);
  a.stroke(
    l,
    [
      [224, 183],
      [665, 62],
      [1304, -17],
    ],
    87,
  );
  a.stroke(
    l,
    [
      [227, 207],
      [660, 96],
      [1253, 8],
    ],
    15,
  );
  a.stroke(
    l,
    [
      [263, 183],
      [330, 165],
      [428, 139],
      [502, 119],
    ],
    2.4,
    undefined,
    6,
    paper,
    fine,
  );
  a.stroke(
    l,
    [
      [574, 94],
      [647, 74],
      [731, 61],
    ],
    3.0,
    undefined,
    6,
    paper,
    fine,
  );
  a.stroke(
    l,
    [
      [386, 130],
      [460, 109],
      [491, 103],
    ],
    1.4,
    undefined,
    6,
    paper,
    fine,
  );
  a.stroke(
    l,
    [
      [329, 177],
      [327, 371],
      [330, 567],
    ],
    18,
  );
  a.stroke(
    l,
    [
      [910, 145],
      [909, 368],
      [911, 565],
    ],
    16,
  );
  a.stroke(
    l,
    [
      [206, 565],
      [660, 567],
      [1260, 576],
    ],
    11,
  );
  const finish = a.layer("Detail / warehouse joints and broken ground", parent);
  a.stroke(
    finish,
    [
      [236, 218],
      [361, 185],
      [458, 162],
    ],
    3.5,
    undefined,
    6,
    ink,
    pencil,
  );
  a.stroke(
    finish,
    [
      [288, 159],
      [404, 128],
      [498, 103],
    ],
    6,
    undefined,
    6,
    ink,
    charcoal,
  );
  a.stroke(
    finish,
    [
      [321, 190],
      [321, 234],
      [323, 259],
    ],
    4,
    undefined,
    6,
    paper,
    pastel,
  );
  a.stroke(
    finish,
    [
      [312, 571],
      [336, 573],
      [363, 570],
    ],
    5.5,
    undefined,
    6,
    ink,
    dry,
  );
  a.stroke(
    finish,
    [
      [887, 571],
      [910, 575],
      [948, 574],
    ],
    5,
    undefined,
    6,
    ink,
    charcoal,
  );
  a.stroke(
    finish,
    [
      [232, 579],
      [366, 581],
      [408, 579],
    ],
    2.1,
    undefined,
    6,
    ink,
    pencil,
  );
  a.stroke(
    finish,
    [
      [1067, 583],
      [1151, 587],
      [1244, 586],
    ],
    2.2,
    undefined,
    6,
    ink,
    pencil,
  );
  return l;
}
