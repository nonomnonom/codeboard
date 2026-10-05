import { amber, contour, ink, insect, keeper, paper, stroke } from "../artwork/art.ts";
import type { SceneContext } from "./types.ts";
export function draw({ panel: p }: SceneContext): void {
  const l = p.addVectorLayer("Puddle / fallen machine");
  contour(l, "M -80 -80 L 1360 -80 L 1360 800 L -80 800 Z", "#303e40");
  // Broad paving courses converge upward; broken edges interrupt the flooded surface.
  for (const [y, depth] of [
    [28, 55],
    [91, 75],
    [179, 98],
    [292, 131],
    [442, 174],
    [640, 226],
  ]) {
    contour(
      l,
      `M -80 ${y} Q 530 ${y! - 31} 1360 ${y! + 22} L 1360 ${y! + depth! - 9} Q 600 ${y! + depth! - 44} -80 ${y! + depth!} Z`,
      "#414e4e",
      ink,
      1.2,
    );
    stroke(
      l,
      [
        [-40, y! + depth! - 7],
        [292, y! + depth! - 23],
        [580, y! + depth! - 29],
        [854, y! + depth! - 17],
        [1300, y! + depth! + 5],
      ],
      1.3,
      "#64716a",
    );
    const width = 160 + y! * 0.3;
    for (let x = -130 + (y! % 3) * 51; x < 1340; x += width) {
      const lean = (x - 790) * 0.09;
      stroke(
        l,
        [
          [x, y! + 4],
          [x + lean * 0.4, y! + depth! * 0.47],
          [x + lean, y! + depth! - 13],
        ],
        2,
        ink,
      );
    }
  }
  contour(
    l,
    "M 593 328 C 732 294 893 326 1026 303 Q 1183 290 1330 361 L 1330 693 C 1199 639 1107 678 966 637 Q 805 597 632 620 C 524 605 544 526 682 502 Q 781 465 659 436 C 562 408 517 363 593 328 Z",
    "#26383b",
    "#26383b",
  );
  stroke(
    l,
    [
      [592, 330],
      [740, 321],
      [885, 333],
      [1026, 310],
      [1180, 318],
    ],
    1.4,
    "#64776f",
  );
  stroke(
    l,
    [
      [667, 616],
      [801, 603],
      [965, 642],
      [1092, 658],
    ],
    1.7,
    "#526860",
  );
  const reflection = p.addVectorLayer("Puddle / lantern reflection", { opacity: 0.65 });
  for (let j = 0; j < 18; j++) {
    const yy = 429 + j * 15,
      xx = 475 + Math.sin(j * 0.8) * 8,
      half = 14 + j * 2.2;
    stroke(
      reflection,
      [
        [xx - half, yy],
        [xx - 4, yy - 1],
      ],
      2 + (j % 3),
      j % 5 === 0 ? paper : amber,
    );
    if (j % 3 !== 0)
      stroke(
        reflection,
        [
          [xx + 5, yy + 1],
          [xx + half, yy - 2],
        ],
        1.6,
        amber,
      );
  }
  keeper(p, -64, -696, 2.2);
  insect(p, 864, 480, 0.65, false, false);
  for (let j = 0; j < 4; j++)
    stroke(
      l,
      [
        [808 - j * 27, 505 + j * 13],
        [866, 510 + j * 13],
        [923 + j * 29, 503 + j * 14],
      ],
      1.2,
      j === 0 ? "#abb5a0" : "#607b73",
    );
}
