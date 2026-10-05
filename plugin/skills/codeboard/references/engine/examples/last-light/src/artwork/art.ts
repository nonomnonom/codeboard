import {
  brushes,
  brushTipFromFunction,
  catmullRom,
  customizeBrush,
  ellipse,
  hatchPolygon,
  pathCommands,
  samplePath,
  withPressure,
  type LayerHandle,
  type PanelHandle,
  type StoryboardProject,
} from "codeboard-studio";
export const ink = "#171c20",
  paper = "#e8e0cd",
  amber = "#edb65d",
  grey = "#68706f";
export const reed = customizeBrush(brushes.cleanInk, {
  id: "brush:keeper-reed",
  name: "Keeper / split reed",
  size: 5,
  tip: brushTipFromFunction(
    24,
    24,
    (x, y) => Math.max(0, 1 - x * x - y * y) * (Math.abs(x - 0.22) < 0.1 ? 0.12 : 1),
  ),
  spacing: 0.12,
  hardness: 0.86,
  taperEnd: 0.22,
});
export const dry = customizeBrush(brushes.shadeBrush, {
  id: "brush:rain-worn",
  name: "Rain-worn bristles",
  size: 22,
  flow: 0.24,
  tip: brushTipFromFunction(
    32,
    16,
    (x, y) => (Math.cos(x * 38) > 0.1 ? 1 : 0.08) * Math.max(0, 1 - x * x - y * y),
  ),
  textureStrength: 0.25,
  spacing: 0.22,
});
export function contour(
  l: LayerHandle,
  d: string,
  fill = ink,
  stroke = ink,
  width = 1.5,
  name?: string,
) {
  return l.path(pathCommands(d), { fill, stroke, strokeWidth: width, ...(name ? { name } : {}) });
}
export function stroke(l: LayerHandle, xy: number[][], width = 2, color = ink, pressure = 0.75) {
  return l.vectorStroke(
    catmullRom(
      xy.map(([x, y], i) => ({
        x: x!,
        y: y!,
        pressure: pressure * (0.65 + 0.35 * Math.sin((i + 1) * 1.4)),
      })),
      6,
    ),
    { width, color, taperStart: 0.06, taperEnd: 0.18 },
  );
}
export function ring(
  l: LayerHandle,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color = ink,
  width = 2,
  fill?: string,
) {
  l.vectorStroke(ellipse(x, y, rx, ry, { samples: 36 }), {
    color,
    width,
    closed: true,
    ...(fill ? { fill } : {}),
  });
}
export function hatch(
  l: LayerHandle,
  polygon: number[][],
  spacing = 7,
  color = ink,
  angle = -0.8,
  width = 1,
) {
  for (const points of hatchPolygon(
    polygon.map(([x, y]) => ({ x: x!, y: y! })),
    { spacing, angle },
  ))
    l.vectorStroke(points, {
      color,
      width,
      pressureSize: 0.3,
      taperStart: 0.1,
      taperEnd: 0.15,
      opacity: 0.65,
    });
}
export function lantern(l: LayerHandle, x: number, y: number, s = 1, lit = true) {
  const P = (d: string, fill: string) => {
    const id = contour(l, d, fill);
    return id;
  };
  // Geometry is authored in place so its panes remain separately editable.
  contour(
    l,
    `M ${x - 19 * s} ${y - 47 * s} Q ${x - 24 * s} ${y - 82 * s} ${x} ${y - 86 * s} Q ${x + 24 * s} ${y - 82 * s} ${x + 19 * s} ${y - 47 * s}`,
    "transparent",
    ink,
    3 * s,
  );
  P(
    `M ${x - 30 * s} ${y - 45 * s} L ${x + 30 * s} ${y - 45 * s} L ${x + 38 * s} ${y + 39 * s} Q ${x} ${y + 54 * s} ${x - 38 * s} ${y + 39 * s} Z`,
    lit ? amber : "#343b3c",
  );
  contour(
    l,
    `M ${x - 35 * s} ${y - 44 * s} L ${x - 22 * s} ${y - 57 * s} L ${x + 22 * s} ${y - 57 * s} L ${x + 35 * s} ${y - 44 * s} Z`,
    ink,
  );
  for (const dx of [-26, 0, 26])
    stroke(
      l,
      [
        [x + dx * s, y - 42 * s],
        [x + dx * 1.15 * s, y + 40 * s],
      ],
      3 * s,
      ink,
    );
  contour(
    l,
    `M ${x - 39 * s} ${y + 37 * s} Q ${x} ${y + 45 * s} ${x + 39 * s} ${y + 37 * s} L ${x + 34 * s} ${y + 52 * s} L ${x - 34 * s} ${y + 52 * s} Z`,
    ink,
  );
  const detail = (d: string, fill = "transparent", color = "#72766a", width = 0.55) => {
    const id = contour(l, d, fill, color, width);
    l.edit(id, (element) => ({ ...element, matrix: [s, 0, 0, s, x, y] }));
  };
  detail("M -18 -56 Q -21 -77 -5 -82 Q 8 -85 17 -71", "transparent", "#788073", 0.85);
  detail("M -22 -57 L 22 -57 L 29 -49 Q 3 -51 -29 -48 Z", "#394345", ink, 0.6);
  detail("M -29 -47 Q -4 -49 28 -47", "transparent", "#9b9b80", 0.65);
  detail("M -21 -59 L -17 -65 L 16 -65 L 21 -59 Z", "#3e494a", ink, 0.7);
  for (const vent of [-12, -6, 0, 6, 12])
    detail(`M ${vent} -63 L ${vent} -60`, "transparent", ink, 1.5);
  detail("M -25 -40 L -24 -29 L -27 21 L -29 36", "transparent", "#a19b7e", 0.7);
  detail("M 25 -38 L 27 -12 L 27 8 M 28 16 L 30 36", "transparent", "#626f68", 0.55);
  detail("M -1 -39 L -1 -17 M -1 -12 L -1 8 M -1 14 L -1 34", "transparent", "#69756c", 0.45);
  detail("M -37 39 Q -2 47 37 39 L 35 44 Q 4 50 -35 44 Z", "#424b47", ink, 0.5);
  detail("M -30 47 Q -1 52 28 47", "transparent", "#92917a", 0.55);
  detail(
    "M -28 49 L -21 49 M -15 50 L -4 51 M 4 51 L 11 50 M 20 49 L 26 48",
    "transparent",
    "#565e53",
    0.8,
  );
  detail("M 31 31 L 37 29 L 41 32 L 40 35 L 35 36 L 31 35 Z", "#555e54", ink, 0.7);
  detail("M 36 31 L 36 34 M 39 32 L 39 34", "transparent", ink, 0.6);
  for (const [dx, dy] of [
    [-26, -39],
    [26, -39],
    [-29, 35],
    [29, 35],
  ]) {
    detail(
      `M ${dx! - 1} ${dy!} Q ${dx!} ${dy! - 1.5} ${dx! + 1} ${dy!} Q ${dx!} ${dy! + 1.5} ${dx! - 1} ${dy!} Z`,
      "#999782",
      ink,
      0.35,
    );
  }
  if (lit)
    contour(
      l,
      `M ${x - 10 * s} ${y + 29 * s} Q ${x - 17 * s} ${y + 10 * s} ${x + 3 * s} ${y - 15 * s} Q ${x + 2 * s} ${y + 5 * s} ${x + 12 * s} ${y + 12 * s} Q ${x + 18 * s} ${y + 33 * s} ${x - 10 * s} ${y + 29 * s}`,
      "#fff1bf",
      "#fff1bf",
      1,
    );
}
function walkingLegs(l: LayerHandle, phase: number) {
  const drawings = [
    [
      "M 127 420 C 144 434 167 432 177 419 L 177 492 L 207 564 L 193 585 L 166 579 L 132 509 Z",
      "M 80 416 L 133 427 L 108 499 L 75 568 L 50 574 L 42 559 L 69 490 Z",
      "M 164 571 Q 183 576 195 567 L 219 588 Q 237 593 240 607 L 177 607 L 160 597 Z",
      "M 44 553 L 74 562 L 67 584 Q 48 594 21 590 L 10 578 Q 36 572 44 553 Z",
    ],
    [
      "M 126 420 C 145 431 163 430 175 421 Q 191 463 181 500 L 184 571 L 153 580 L 143 507 L 126 477 Z",
      "M 82 418 L 133 427 L 110 491 L 74 548 L 54 554 L 43 540 Q 50 517 68 480 Z",
      "M 153 568 Q 170 573 183 568 L 193 589 Q 211 595 215.5 607 L 153 607 L 147 593 Z",
      "M 44 533 L 72 542 L 64 558 L 56 572 Q 42 579 29 570 L 26 557 L 38 547 Z",
    ],
    [
      "M 125 420 L 172 422 Q 199 473 186 509 L 162 572 L 131 578 L 141 511 L 122 482 Z",
      "M 84 420 L 132 427 L 110 486 L 78 524 L 69 541 L 47 531 Q 44 514 58 495 L 74 458 Z",
      "M 132 568 L 162 569 L 170 589 Q 188 592 191 607 L 132 607 L 124 595 Z",
      "M 47 522 L 71 530 L 67 543 L 85 551 L 87 562 Q 55 565 36 546 Z",
    ],
    [
      "M 120 420 L 165 424 Q 175 468 161 504 L 136 575 L 106 579 L 116 506 L 115 476 Z",
      "M 114 421 L 158 427 Q 176 456 173 480 L 145 514 L 125 544 L 100 536 L 117 499 L 132 476 L 106 457 Z",
      "M 107 569 L 136 571 L 145 590 Q 162 593 166.5 607 L 106 607 L 99 594 Z",
      "M 101 529 L 126 535 L 132 546 L 153 551 L 155 563 L 109 562 L 94 549 Z",
    ],
    [
      "M 113 420 L 155 424 L 141 496 L 112 577 L 82 579 L 95 500 Z",
      "M 142 425 L 175 425 Q 214 470 212 490 L 184 529 L 174 541 L 148 532 L 173 484 L 137 463 Z",
      "M 82 570 L 111 572 L 120 591 Q 139 593 142 607 L 82 607 L 75 592 Z",
      "M 149 526 L 178 532 L 185 539 L 207 541 L 210 553 L 155 553 L 140 543 Z",
    ],
    [
      "M 108 420 L 152 424 L 126 495 L 94 574 L 66 581 L 67 560 L 84 495 Z",
      "M 145 425 L 176 425 Q 220 456 229 480 L 217 523 L 211 545 L 183 540 L 186 507 L 192 484 L 143 465 Z",
      "M 67 565 L 96 571 L 95 589 Q 111 595 117.5 607 L 64 607 L 57 591 Z",
      "M 184 532 L 213 537 L 224 545 L 249 549 L 252 562 L 196 563 L 178 552 Z",
    ],
    [
      "M 104 420 L 150 423 L 111 493 L 80 570 L 58 582 L 42 569 L 74 490 Z",
      "M 146 423 L 178 426 Q 215 445 239 471 L 273 539 L 245 553 L 202 494 L 145 473 Z",
      "M 47 561 L 77 569 L 72 585 L 93 596 L 93 607 L 69 607 L 37 581 Z",
      "M 245 538 L 273 539 L 280 549 L 304 556 L 306 570 L 254 570 L 237 558 Z",
    ],
    [
      "M 101 420 L 148 424 L 99 495 L 61 570 L 41 579 L 26 565 L 64 491 Z",
      "M 145 424 L 179 425 Q 211 456 224 491 L 235 568 L 207 578 L 194 503 L 151 477 Z",
      "M 28 558 L 58 568 L 54 586 L 68.5 600 L 68.5 607 L 54 607 L 22 580 Z",
      "M 206 568 L 234 565 L 241 580 Q 258 584 264.5 597 L 208 597 L 201 585 Z",
    ],
  ][phase % 8]!;
  const stance = phase < 8 ? ink : "#394446",
    swing = phase < 8 ? "#394446" : ink;
  const order = phase < 8 ? [1, 3, 0, 2] : [0, 2, 1, 3];
  for (const index of order) contour(l, drawings[index]!, index % 2 ? swing : stance);
  const toe = 240 - (phase % 8) * 24.5;
  stroke(
    l,
    [
      [toe - 54, 598],
      [toe - 24, 600],
      [toe - 8, 603],
    ],
    1.6,
    paper,
  );
}
export function walkingTorso(phase: number) {
  const index = phase % 8;
  const rotation = [0.08, 0.105, 0.12, 0.1, 0.075, 0.055, 0.06, 0.07][index]!;
  return {
    rotation,
    settle: [0, 3, 5, 1, -3, -6, -7, -3][index]!,
    headRotation: (0.08 - rotation) * 0.5,
  };
}
export function keeper(
  p: PanelHandle,
  x: number,
  y: number,
  s: number,
  pose: "walk" | "step" | "bend" | "watch" | "look-up" = "walk",
  lit = true,
  gait?: number,
  parentId?: string,
) {
  const g = p.addGroup(
    "Keeper / coat, face, hands",
    { transform: { x, y, scaleX: s, scaleY: s, rotation: 0 } },
    parentId,
  );
  if (lit && pose === "walk") {
    const reflected = p.addVectorLayer("Lantern / ground reflection", { opacity: 0.5 }, g.id);
    for (let row = 0; row < 17; row++) {
      const yy = (gait === undefined ? 638 : 615) + row * 10,
        xx = 243 + Math.sin(row * 1.3) * 5,
        half = 8 + row * 0.9;
      stroke(
        reflected,
        [
          [xx - half, yy],
          [xx - 2, yy + 0.6],
        ],
        1.7 + (row % 3) * 0.5,
        row % 4 === 0 ? paper : amber,
      );
      if (row % 3 !== 0)
        stroke(
          reflected,
          [
            [xx + 3, yy],
            [xx + half * 0.8, yy - 1],
          ],
          1.4,
          amber,
        );
    }
  }
  let l = p.addVectorLayer("Keeper boots and legs", {}, g.id);
  // Weight falls on the forward boot; the rear heel lifts into the rain.
  if (gait !== undefined) {
    walkingLegs(l, gait);
  } else if (pose === "bend") {
    contour(
      l,
      "M 78 416 L 131 427 L 112 503 L 161 551 Q 171 572 154 583 L 79 547 Q 57 533 65 501 Z",
      ink,
    );
    contour(
      l,
      "M 126 416 L 175 414 L 222 477 Q 235 490 225 508 L 203 566 L 167 566 L 179 507 L 132 481 Z",
      ink,
    );
    contour(l, "M 166 554 L 207 555 L 213 582 L 254 589 L 265 605 L 170 606 Z", ink);
    contour(l, "M 129 554 L 158 570 L 148 594 L 96 595 Q 88 580 112 578 Z", ink);
    stroke(
      l,
      [
        [175, 596],
        [226, 597],
        [253, 600],
      ],
      2,
      paper,
    );
  } else if (pose === "watch" || pose === "look-up" || pose === "step") {
    contour(l, "M 77 419 L 123 425 L 113 503 L 102 575 L 73 575 L 79 494 Z", ink);
    contour(l, "M 127 420 L 171 419 L 161 506 L 168 579 L 139 583 L 120 506 Z", ink);
    contour(l, "M 74 566 L 103 568 L 112 587 L 136 596 L 140 607 L 70 607 Z", ink);
    contour(l, "M 136 573 L 167 571 L 182 590 L 207 598 L 209 608 L 140 609 Z", ink);
    stroke(
      l,
      [
        [145, 597],
        [175, 598],
        [199, 602],
      ],
      2,
      paper,
    );
  } else {
    contour(
      l,
      "M 127 420 C 144 434 167 432 177 419 L 177 492 L 207 564 L 193 585 L 166 579 L 132 509 Z",
      ink,
    );
    contour(l, "M 80 416 L 133 427 L 108 499 L 75 568 L 50 574 L 42 559 L 69 490 Z", ink);
    contour(
      l,
      "M 164 571 Q 183 576 195 567 L 219 588 Q 237 593 240 607 L 177 608 L 160 597 Z",
      ink,
    );
    contour(l, "M 44 553 L 74 562 L 67 584 Q 48 594 21 590 L 10 578 Q 36 572 44 553 Z", ink);
    stroke(
      l,
      [
        [177, 596],
        [206, 597],
        [231, 601],
      ],
      2,
      paper,
    );
    stroke(
      l,
      [
        [27, 578],
        [51, 579],
        [63, 572],
      ],
      2,
      paper,
    );
  }
  const gaitPose = gait === undefined ? undefined : walkingTorso(gait);
  const angle = pose === "bend" ? 0.32 : (gaitPose?.rotation ?? 0);
  const settle = gaitPose?.settle ?? 0;
  const torso = p.addGroup(
    "Keeper torso / hip pivot",
    { pivot: { x: 130, y: 430 }, transform: { y: settle, rotation: angle } },
    g.id,
  );
  l = p.addVectorLayer("Keeper coat, face and hands", {}, torso.id);
  contour(
    l,
    "M 122 151 C 86 158 70 199 57 243 L 30 406 L 6 453 C 55 455 86 437 112 441 C 147 450 170 448 214 431 L 191 335 L 189 220 C 186 178 160 157 122 151 Z",
    "#414b4c",
  );
  contour(
    l,
    "M 123 168 C 99 216 97 284 78 336 L 45 422 L 18 447 Q 64 447 110 429 L 130 353 L 147 246 Z",
    ink,
  );
  contour(l, "M 149 184 L 175 239 L 161 332 L 187 426 L 154 433 L 133 337 Z", "#697271");
  contour(
    l,
    "M 117 183 C 104 222 102 261 91 297 L 79 329 C 88 300 89 251 94 228 Q 98 203 117 183 Z",
    "#858d80",
    "#858d80",
    0.5,
  );
  contour(
    l,
    "M 143 202 Q 163 226 158 262 L 147 309 L 146 335 L 169 416 L 157 414 Q 132 349 138 320 L 146 269 Q 152 236 143 202 Z",
    "#929889",
    "#929889",
    0.5,
  );
  contour(
    l,
    "M 73 342 C 58 373 46 408 28 435 Q 58 425 79 414 L 69 431 L 35 443 L 18 447 Q 46 417 73 342 Z",
    "#56605b",
    "#56605b",
    0.5,
  );
  stroke(
    l,
    [
      [100, 230],
      [93, 273],
      [89, 292],
    ],
    1.2,
    paper,
  );
  stroke(
    l,
    [
      [145, 279],
      [140, 321],
      [143, 349],
      [163, 411],
    ],
    1.3,
    "#bcc1aa",
  );
  stroke(
    l,
    [
      [126, 191],
      [136, 245],
      [118, 325],
      [106, 409],
    ],
    3,
    paper,
  );
  stroke(
    l,
    [
      [162, 274],
      [159, 326],
      [181, 404],
    ],
    2,
    paper,
  );
  stroke(
    l,
    [
      [82, 254],
      [64, 333],
      [56, 377],
    ],
    2,
    "#92998f",
  );
  contour(l, "M 147 293 L 176 286 L 180 319 L 151 328 Z", ink);
  stroke(
    l,
    [
      [152, 299],
      [170, 295],
    ],
    2,
    paper,
  );
  for (let i = 0; i < 5; i++) ring(l, 139 - i * 2, 231 + i * 31, 2.3, 2.3, paper, 1, paper);
  hatch(
    l,
    [
      [152, 342],
      [179, 404],
      [170, 421],
      [142, 350],
    ],
    6,
    ink,
    -0.9,
  );
  hatch(
    l,
    [
      [72, 222],
      [105, 191],
      [93, 302],
      [58, 389],
      [48, 409],
    ],
    4.5,
    "#151e21",
    -1.05,
    1.1,
  );
  hatch(
    l,
    [
      [172, 224],
      [193, 250],
      [174, 287],
      [158, 299],
    ],
    4,
    ink,
    -0.8,
    0.9,
  );
  if (pose === "walk" && gait === undefined)
    hatch(
      l,
      [
        [126, 447],
        [146, 445],
        [167, 516],
        [191, 566],
        [177, 570],
        [133, 506],
      ],
      4,
      "#818b80",
      -0.3,
      1,
    );
  contour(l, "M 125 123 L 164 120 L 170 164 L 137 188 L 115 160 Z", "#aba997");
  contour(
    l,
    "M 128 131 Q 145 146 164 137 L 168 156 Q 153 153 140 168 L 134 155 Z",
    "#717a6d",
    "#717a6d",
    0.5,
  );
  stroke(
    l,
    [
      [132, 148],
      [137, 160],
      [142, 164],
    ],
    1,
    "#515e52",
  );
  hatch(
    l,
    [
      [127, 137],
      [135, 153],
      [138, 166],
      [130, 160],
      [124, 152],
    ],
    2.6,
    "#626e5d",
    -0.6,
    0.7,
  );
  contour(
    l,
    "M 109 159 C 126 151 151 149 171 153 Q 177 164 188 177 L 159 183 Q 147 180 135 169 L 127 192 Q 115 184 107 178 Z",
    paper,
  );
  contour(
    l,
    "M 109 164 Q 119 160 133 161 L 128 172 L 127 185 Q 116 178 109 175 Z",
    "#babba8",
    "#babba8",
    0.4,
  );
  contour(
    l,
    "M 136 156 Q 152 154 170 157 L 182 175 Q 165 170 155 163 Z",
    "#c4c2ad",
    "#c4c2ad",
    0.4,
  );
  stroke(
    l,
    [
      [116, 161],
      [130, 157],
      [146, 157],
      [162, 160],
    ],
    1.2,
    "#6f7869",
  );
  stroke(
    l,
    [
      [136, 163],
      [148, 170],
      [158, 176],
      [173, 178],
    ],
    1.2,
    "#737c6c",
  );
  stroke(
    l,
    [
      [129, 168],
      [125, 177],
      [124, 183],
    ],
    1.3,
    ink,
  );
  for (const [x, y] of [
    [142, 164],
    [146, 166],
    [150, 169],
    [154, 172],
  ])
    stroke(
      l,
      [
        [x!, y!],
        [x! + 1.6, y! + 3.5],
      ],
      0.6,
      "#8c9381",
    );
  contour(
    l,
    "M 116 170 C 90 182 74 189 45 184 L 17 169 L 31 188 L 10 191 C 49 221 85 201 124 185 Z",
    "#a7a998",
  );
  stroke(
    l,
    [
      [23, 183],
      [57, 195],
      [89, 189],
      [115, 177],
    ],
    2,
    ink,
  );
  // Profile: brow, nose bridge, nostril, upper lip and lower jaw are distinct contours.
  const coat = l,
    headAngle = pose === "look-up" ? -0.18 : (gaitPose?.headRotation ?? 0);
  const head = p.addGroup(
    "Keeper / head and gaze",
    { pivot: { x: 140, y: 160 }, transform: { rotation: headAngle } },
    torso.id,
  );
  l = p.addVectorLayer("Keeper / face, hair and hat", {}, head.id);
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
  l = coat;
  if (pose === "bend") {
    contour(
      l,
      "M 169 185 C 201 190 212 224 230 243 L 285 222 L 300 245 C 268 270 244 279 225 279 C 196 267 178 245 160 218 Z",
      "#5d6867",
    );
    contour(
      l,
      "M 281 224 L 300 216 L 313 207 Q 321 207 318 217 L 308 230 L 334 226 Q 344 230 334 236 L 308 245 L 298 251 Z",
      paper,
    );
    stroke(
      l,
      [
        [183, 205],
        [206, 244],
        [229, 260],
        [278, 236],
      ],
      2,
      paper,
    );
  } else {
    contour(
      l,
      "M 165 184 C 193 183 202 218 204 251 L 239 300 L 221 317 L 174 269 L 153 218 Z",
      "#596462",
    );
    contour(
      l,
      "M 167 190 Q 188 193 193 225 L 196 253 L 223 293 L 213 285 L 183 251 Q 182 215 167 190 Z",
      "#88917e",
      "#88917e",
      0.5,
    );
    contour(l, "M 177 260 L 189 267 L 214 304 L 221 313 L 215 307 Z", ink, ink, 0.5);
    stroke(
      l,
      [
        [186, 250],
        [194, 255],
        [199, 253],
      ],
      1.2,
      ink,
    );
    stroke(
      l,
      [
        [189, 258],
        [201, 269],
        [206, 280],
      ],
      1.2,
      ink,
    );
    contour(
      l,
      "M 229 297 Q 240 302 246 314 L 252 326 Q 254 334 249 339 L 234 340 Q 226 334 226 323 L 218 317 L 215 306 Z",
      paper,
    );
    stroke(
      l,
      [
        [172, 201],
        [184, 250],
        [224, 300],
      ],
      2,
      paper,
    );
    if (pose === "walk" || pose === "step" || pose === "watch" || pose === "look-up") {
      if (gait === undefined) lantern(l, 243, 409, 0.88, lit);
      else {
        const swing = [0.02, -0.01, -0.035, -0.055, -0.06, -0.04, -0.015, 0.005][gait % 8]!,
          handleTop = 409 - 86 * 0.88;
        const suspended = p.addGroup(
          "Lantern / handle pivot",
          {
            transform: {
              x: 243 - 243 * Math.cos(swing) + handleTop * Math.sin(swing),
              y: handleTop - 243 * Math.sin(swing) - handleTop * Math.cos(swing),
              rotation: swing,
            },
          },
          torso.id,
        );
        lantern(p.addVectorLayer("Lantern / gait drawing", {}, suspended.id), 243, 409, 0.88, lit);
      }
      {
        const grip = p.addVectorLayer("Keeper / fingers around lantern handle", {}, torso.id);
        contour(
          grip,
          "M 228 323 Q 229 319 233 321 L 237 330 L 237 337 Q 235 341 232 337 Z",
          paper,
          ink,
          0.8,
        );
        contour(
          grip,
          "M 233 322 Q 236 320 239 324 L 242 333 L 241 340 Q 238 343 236 339 L 235 332 Z",
          paper,
          ink,
          0.85,
        );
        contour(
          grip,
          "M 239 323 Q 242 321 245 325 L 248 333 L 247 339 Q 244 342 242 338 L 242 332 Z",
          paper,
          ink,
          0.85,
        );
        contour(
          grip,
          "M 245 324 Q 248 323 250 328 L 252 333 Q 252 339 248 339 L 247 331 Z",
          paper,
          ink,
          0.8,
        );
        contour(
          grip,
          "M 230 316 Q 236 315 240 319 L 247 325 Q 248 329 244 330 Q 239 329 235 324 L 230 322 Z",
          paper,
          ink,
          0.85,
        );
        stroke(
          grip,
          [
            [233, 328],
            [234, 332],
            [234, 335],
          ],
          0.55,
          "#78816e",
        );
        stroke(
          grip,
          [
            [239, 332],
            [239, 336],
          ],
          0.55,
          "#78816e",
        );
        stroke(
          grip,
          [
            [245, 332],
            [245, 336],
          ],
          0.55,
          "#78816e",
        );
        stroke(
          grip,
          [
            [237, 319],
            [241, 322],
            [243, 324],
          ],
          0.55,
          "#78816e",
        );
      }
    }
  }
  const texture = p.addRasterLayer("Keeper dry seams", {}, torso.id);
  for (let i = 0; i < 8; i++)
    texture.rasterStroke(
      catmullRom(
        [
          { x: 75 + i * 4, y: 252 + i * 5, pressure: 0.35 },
          { x: 64 + i * 5, y: 331, pressure: 0.7 },
          { x: 43 + i * 7, y: 411, pressure: 0.15 },
        ],
        8,
      ),
      dry,
      { color: "#11191c", seed: 70 + i },
    );
  texture.rasterStroke(
    catmullRom(
      [
        { x: 153, y: 175, pressure: 0.1 },
        { x: 163, y: 230, pressure: 0.7 },
        { x: 155, y: 286, pressure: 0.3 },
      ],
      8,
    ),
    reed,
    { color: paper, seed: 4 },
  );
  return g;
}
export function city(p: PanelHandle, light = false) {
  const sky = p.addVectorLayer("Rain sky", { depth: 5 });
  contour(
    sky,
    "M -512 -512 L 1792 -512 L 1792 1232 L -512 1232 Z",
    light ? "#a4aaa0" : "#3f4849",
    light ? "#a4aaa0" : "#3f4849",
  );
  contour(
    sky,
    "M 0 92 C 230 118 348 55 588 103 C 845 158 1129 29 1280 85 L 1280 257 L 0 220 Z",
    light ? "#919a93" : "#343e40",
    light ? "#919a93" : "#343e40",
  );
  const far = p.addVectorLayer("Distant rooftops", { depth: 3 });
  for (let i = 0; i < 18; i++) {
    const x = i * 83 - 40,
      top = 120 + ((i * 47) % 115);
    contour(
      far,
      `M ${x} 407 L ${x} ${top + 25} L ${x + 22} ${top + 25} L ${x + 24} ${top} L ${x + 56} ${top + 12} L ${x + 60} ${top + 37} L ${x + 79} ${top + 37} L ${x + 83} 407 Z`,
      light ? "#737e79" : "#283235",
      light ? "#737e79" : "#283235",
    );
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 2; c++)
        contour(
          far,
          `M ${x + 18 + c * 27} ${top + 64 + r * 35} L ${x + 27 + c * 27} ${top + 64 + r * 35} L ${x + 27 + c * 27} ${top + 82 + r * 35} L ${x + 18 + c * 27} ${top + 82 + r * 35} Z`,
          light && (i + r + c) % 4 === 0 ? amber : "#364143",
          "#364143",
          0.5,
        );
  }
  const street = p.addVectorLayer("Wet street / perspective", { depth: 1 });
  contour(street, "M 0 410 L 1280 410 L 1280 720 L 0 720 Z", light ? "#657270" : "#242e31");
  contour(
    street,
    "M 599 389 L 652 391 L 1080 720 L 176 720 Z",
    light ? "#a4aaa0" : "#4c5756",
    light ? "#a4aaa0" : "#4c5756",
  );
  for (let i = 0; i < 18; i++) {
    const yy = 425 + i * i * 0.9;
    stroke(
      street,
      [
        [0, yy],
        [320, yy + 5],
        [642, yy - 3],
        [980, yy + 3],
        [1280, yy],
      ],
      1.5,
      "#364748",
    );
  }
  for (const x of [-500, -180, 180, 450, 900, 1200, 1650])
    stroke(
      street,
      [
        [624, 402],
        [x, 720],
      ],
      1.4,
      "#435351",
    );
  const walls = p.addVectorLayer("Near buildings / carved masonry", { depth: 1.4 });
  contour(walls, "M 0 0 L 255 0 L 343 102 L 343 456 L 0 682 Z", ink);
  contour(walls, "M 34 0 L 238 0 L 307 98 L 307 458 L 34 609 Z", "#293135");
  contour(walls, "M 1280 0 L 1045 0 L 911 149 L 911 448 L 1280 649 Z", ink);
  contour(walls, "M 1085 0 L 1218 0 L 1218 588 L 950 447 L 950 143 Z", "#343c3d");
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 3; col++) {
      const x = 60 + col * 82,
        y = 65 + row * 91 + col * 13;
      contour(
        walls,
        `M ${x} ${y} L ${x + 40} ${y + 8} L ${x + 40} ${y + 60} L ${x} ${y + 62} Z`,
        light && row % 2 === col % 2 ? amber : "#111e23",
      );
      stroke(
        walls,
        [
          [x - 4, y - 3],
          [x + 45, y + 5],
        ],
        2,
        "#88958a",
      );
      stroke(
        walls,
        [
          [x + 20, y + 8],
          [x + 20, y + 60],
        ],
        2,
        ink,
      );
      const xr = 985 + col * 82,
        yr = 142 + row * 77 - col * 22;
      contour(
        walls,
        `M ${xr} ${yr} L ${xr + 40} ${yr - 11} L ${xr + 40} ${yr + 41} L ${xr} ${yr + 40} Z`,
        light ? amber : "#152226",
      );
      stroke(
        walls,
        [
          [xr + 20, yr],
          [xr + 20, yr + 40],
        ],
        2,
        ink,
      );
    }
  for (let y = 32; y < 570; y += 25)
    stroke(
      walls,
      [
        [37, y],
        [145, y + 14],
        [304, y + 50],
      ],
      1,
      "#65716b",
    );
  contour(walls, "M 349 221 L 493 222 L 489 233 L 344 233 Z", ink);
  stroke(
    walls,
    [
      [474, 229],
      [474, 269],
    ],
    3,
    ink,
  );
  contour(walls, "M 439 267 L 504 267 L 504 324 L 439 324 Z", "#a2a797");
  walls.text("LUX", 447, 301, { font: "700 21px Georgia", color: ink });
  for (let i = 0; i < 5; i++)
    stroke(
      walls,
      [
        [300, 65 + i * 8],
        [680, 114 + i * 4],
        [954, 52 + i * 12],
      ],
      1.2,
      ink,
    );
  const reflection = p.addVectorLayer("Broken reflections", { depth: 1 });
  if (light)
    for (let i = 0; i < 40; i++) {
      const yy = 452 + i * 6,
        spread = (yy - 405) * 1.25;
      const xx = light ? (i % 2 ? 620 - spread : 620 + spread) : 620;
      stroke(
        reflection,
        [
          [xx - 10 - i * 0.9, yy],
          [xx + 8 + i * 0.5, yy + 1],
        ],
        2 + (i % 3),
        light ? amber : "#bbc0ad",
      );
    }
  if (light)
    for (let i = 0; i < 45; i++) {
      const y = 488 + i * 5,
        side = i % 2 ? -1 : 1,
        x = 625 + side * (y - 420) * 1.35;
      stroke(
        reflection,
        [
          [x - 5 - i * 0.4, y],
          [x + 18 + i * 0.9, y + 1],
          [x + 26 + i * 0.6, y],
        ],
        3 + (i % 4),
        amber,
      );
    }
  hatch(
    walls,
    [
      [36, 12],
      [73, 18],
      [73, 579],
      [36, 604],
    ],
    6,
    "#8c968b",
    -0.95,
    0.8,
  );
  hatch(
    walls,
    [
      [269, 70],
      [306, 99],
      [306, 458],
      [269, 479],
    ],
    4,
    "#111f25",
    -0.85,
    1.2,
  );
  hatch(
    walls,
    [
      [955, 150],
      [986, 112],
      [986, 464],
      [955, 446],
    ],
    5,
    "#9ba38d",
    0.85,
    0.8,
  );
  for (let side = 0; side < 2; side++)
    for (let j = 0; j < 20; j++) {
      const y = 40 + j * 25,
        x = side ? 1135 : 111;
      stroke(
        walls,
        [
          [x, y],
          [x + 37, y + 4],
        ],
        1,
        "#8d9788",
      );
      stroke(
        walls,
        [
          [x + 37, y + 4],
          [x + 37, y + 12],
        ],
        1,
        "#18282b",
      );
    }
  const details = p.addVectorLayer("Drainpipes, balconies and cornices", { depth: 1.4 });
  for (const x of [17, 319, 936, 1249]) {
    stroke(
      details,
      [
        [x, 0],
        [x, 470],
        [x - 5, 490],
        [x - 5, 620],
      ],
      6,
      ink,
    );
    stroke(
      details,
      [
        [x - 2, 0],
        [x - 2, 466],
      ],
      1.5,
      "#869486",
    );
    for (let j = 0; j < 6; j++)
      stroke(
        details,
        [
          [x - 7, j * 87 + 25],
          [x + 5, j * 87 + 25],
        ],
        3,
        ink,
      );
  }
  for (const [x, y] of [
    [59, 315],
    [142, 237],
    [1056, 275],
    [1138, 333],
  ] as const) {
    contour(
      details,
      `M ${x - 8} ${y} L ${x + 55} ${y + 6} L ${x + 61} ${y + 23} L ${x - 12} ${y + 18} Z`,
      ink,
    );
    for (let j = 0; j < 6; j++)
      stroke(
        details,
        [
          [x + j * 10, y - 20],
          [x + j * 10, y + 10],
        ],
        2,
        ink,
      );
    stroke(
      details,
      [
        [x - 8, y - 21],
        [x + 57, y - 16],
      ],
      3,
      ink,
    );
  }
  const scratches = p.addRasterLayer("Rain-softened masonry");
  for (let i = 0; i < 12; i++)
    scratches.rasterStroke(
      catmullRom(
        [
          { x: 50 + i * 19, y: 330 + (i % 3) * 12, pressure: 0.12 },
          { x: 55 + i * 19, y: 373, pressure: 0.45 },
          { x: 49 + i * 19, y: 420, pressure: 0.1 },
        ],
        5,
      ),
      dry,
      { color: "#899185", seed: i },
    );
  // Slightly broken curb contours keep perspective explicit without a full-screen grid.
  stroke(
    details,
    [
      [343, 456],
      [292, 495],
      [197, 568],
      [45, 698],
    ],
    4,
    ink,
  );
  stroke(
    details,
    [
      [912, 448],
      [996, 496],
      [1131, 578],
      [1280, 664],
    ],
    4,
    ink,
  );
}
const rainTile = { period: 15, height: 240, drift: -96 };
export function rain(
  p: PanelHandle,
  board: StoryboardProject,
  start: number,
  duration: number,
  intensity = 80,
) {
  const l = p.addVectorLayer("Rain / foreground streaks", { depth: 0.7, opacity: 0.35 });
  const { height: tileHeight, drift: tileDrift } = rainTile;
  const count = Math.ceil((((intensity * tileHeight) / 720) * 2200) / 1280);
  for (let i = 0; i < count; i++) {
    const x = ((i * 173) % 2200) - 400,
      y = ((i * 97) % tileHeight) - 60;
    for (let band = -2; band <= 4; band++) {
      const xx = x + band * tileDrift,
        yy = y + band * tileHeight;
      stroke(
        l,
        [
          [xx, yy],
          [xx - 24, yy + 60],
        ],
        i % 5 === 0 ? 1.6 : 0.8,
        paper,
      );
    }
  }
  timeRain(board, l.id, start, duration);
}
export function timeRain(
  board: StoryboardProject,
  layerId: string,
  start: number,
  duration: number,
) {
  const { period, height: tileHeight, drift: tileDrift } = rainTile;
  for (const key of board.production.layer(layerId).keyframes)
    board.production.removeLayerKeyframe(layerId, key.id);
  const offsets = new Set([0, duration - 1]);
  for (let frame = 0; frame < duration; frame += period) {
    offsets.add(frame);
    if (frame + period - 1 < duration) offsets.add(frame + period - 1);
  }
  for (const offset of [...offsets].sort((a, b) => a - b)) {
    const phase = offset % period;
    board.production.addLayerKeyframe(layerId, start + offset, {
      transform: { x: (tileDrift * phase) / period, y: (tileHeight * phase) / period },
      easing: phase === period - 1 ? "hold" : "linear",
    });
  }
}
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
export const fingerShadows = [
  "M 557 305 C 581 298 598 291 620 286 Q 666 273 691 269 Q 688 279 674 282 L 636 297 L 609 308 C 591 311 573 309 557 305 Z",
  "M 603 340 C 624 334 646 332 673 329 Q 710 327 735 317 Q 736 326 716 331 L 674 337 L 648 345 C 632 345 618 343 603 340 Z",
  "M 608 385 C 633 380 653 381 678 381 Q 709 380 737 371 Q 734 382 714 385 L 672 388 L 636 394 C 626 391 617 388 608 385 Z",
  "M 566 430 Q 605 415 637 418 Q 665 422 693 414 Q 695 427 677 429 L 564 445 Z",
];
export function supportingHand(p: PanelHandle) {
  const group = p.addGroup("Supporting hand / articulated drawing");
  const l = p.addVectorLayer("Supporting hand / articulated fingers", {}, group.id);
  contour(l, "M 0 428 L 234 379 L 324 405 L 335 566 L 0 696 Z", "#677371");
  contour(l, "M 224 385 L 286 367 L 352 533 L 299 566 Z", paper);
  hatch(
    l,
    [
      [230, 386],
      [274, 376],
      [335, 529],
      [303, 548],
    ],
    7,
    ink,
    -1,
    1.8,
  );
  contour(
    l,
    "M 291 388 C 337 370 369 335 408 314 C 435 298 467 291 490 274 L 551 222 Q 571 210 580 225 Q 586 235 570 252 L 533 295 Q 558 284 573 284 Q 582 279 595 277 L 641 259 Q 658 252 668 251 Q 691 245 697 258 Q 704 275 677 284 L 653 294 Q 641 300 633 298 L 608 311 Q 628 308 637 310 Q 647 303 660 304 L 708 298 Q 732 294 739 306 Q 746 324 726 330 L 714 333 Q 687 340 673 338 L 647 347 Q 632 347 618 352 Q 639 356 654 353 Q 667 348 681 352 L 716 351 Q 741 351 740 366 Q 742 382 722 385 L 711 387 Q 681 392 667 388 L 637 396 Q 619 393 602 398 L 636 402 Q 648 398 660 401 L 675 401 Q 697 403 695 415 Q 698 427 679 431 L 669 432 L 565 447 C 501 453 471 496 416 512 L 354 526 Z",
    paper,
    ink,
    2.2,
    "palm-contour",
  );
  for (const d of fingerShadows) contour(l, d, "#babca6", "#babca6", 0.6);
  contour(
    l,
    "M 305 419 C 355 405 385 405 405 379 L 457 336 L 431 388 C 445 419 492 428 559 413 L 669 419 L 565 447 C 502 454 460 502 411 512 L 354 526 Z",
    "#9ca18f",
    "#9ca18f",
    1,
  );
  stroke(
    l,
    [
      [375, 419],
      [412, 390],
      [461, 381],
      [501, 362],
    ],
    3,
    ink,
  );
  stroke(
    l,
    [
      [408, 452],
      [449, 421],
      [491, 418],
    ],
    2,
    ink,
  );
  stroke(
    l,
    [
      [479, 302],
      [506, 318],
      [521, 340],
    ],
    2,
    ink,
  );
  for (const [x, y] of [
    [566, 245],
    [678, 266],
    [719, 312],
    [716, 367],
    [672, 414],
  ]) {
    stroke(
      l,
      [
        [x! - 13, y!],
        [x! - 3, y! - 6],
        [x! + 3, y! + 2],
      ],
      1.6,
      ink,
    );
  }
  for (const d of [
    "M 617 275 Q 627 279 629 290 M 610 280 Q 615 285 615 289",
    "M 666 307 Q 675 315 673 325 M 658 309 Q 665 317 664 326",
    "M 670 356 Q 677 365 674 375 M 663 357 Q 668 364 665 371",
    "M 637 405 Q 644 412 640 419 M 630 405 Q 634 411 632 415",
    "M 494 347 C 532 347 557 328 584 322 M 460 367 C 486 379 521 372 549 355",
    "M 449 411 C 470 396 493 390 514 392 M 427 467 Q 449 451 464 431",
  ])
    l.path(pathCommands(d), { stroke: "#636c5e", strokeWidth: 1, name: "palm-flexion-crease" });
  hatch(
    l,
    [
      [326, 445],
      [358, 470],
      [394, 490],
      [355, 511],
    ],
    7,
    ink,
    -0.6,
  );
  hatch(
    l,
    [
      [355, 491],
      [400, 505],
      [452, 479],
      [487, 452],
      [457, 461],
      [406, 482],
    ],
    5,
    "#596256",
    -0.8,
    1,
  );
  hatch(
    l,
    [
      [514, 424],
      [562, 431],
      [627, 418],
      [612, 413],
      [553, 422],
    ],
    4,
    "#687160",
    -0.9,
    0.8,
  );
  hatch(
    l,
    [
      [395, 373],
      [432, 344],
      [463, 324],
      [452, 349],
      [419, 380],
    ],
    5,
    "#687160",
    -0.6,
    0.8,
  );
  for (const [x, y] of [
    [543, 298],
    [585, 324],
    [591, 369],
    [574, 413],
  ]) {
    stroke(
      l,
      [
        [x! - 6, y! - 6],
        [x!, y!],
        [x! + 2, y! + 9],
      ],
      1.3,
      "#616b5b",
    );
    stroke(
      l,
      [
        [x! - 13, y! - 4],
        [x! - 8, y! + 4],
      ],
      0.8,
      "#616b5b",
    );
  }
  stroke(
    l,
    [
      [363, 414],
      [376, 446],
      [389, 453],
    ],
    1.2,
    ink,
  );
  stroke(
    l,
    [
      [382, 417],
      [396, 426],
      [418, 415],
    ],
    1,
    ink,
  );
  const rough = p.addRasterLayer(
    "Pencil construction / hand modelling",
    { opacity: 0.32 },
    group.id,
  );
  for (let j = 0; j < 6; j++)
    rough.rasterStroke(
      catmullRom(
        [
          { x: 331 + j * 8, y: 429 + j * 4, pressure: 0.2 },
          { x: 369 + j * 8, y: 445 + j * 5, pressure: 0.6 },
          { x: 406 + j * 8, y: 455 + j * 3, pressure: 0.1 },
        ],
        6,
      ),
      { ...brushes.roughPencil, size: 2.3 },
      { color: ink, seed: j },
    );
  const accents = p.addRasterLayer("Supporting hand / pressure ink", {}, group.id);
  const edges = pathCommands(
    "M 697 263 Q 701 275 677 284 L 653 294 Q 641 300 633 298 L 608 311 M 740 313 Q 745 326 714 333 Q 687 340 673 338 L 647 347 M 740 368 Q 741 382 711 387 Q 681 392 667 388 L 637 396 M 693 417 Q 696 428 669 432 L 565 447 C 501 453 471 496 416 512",
  );
  for (const points of samplePath(edges, { step: 1 }))
    accents.rasterStroke(
      withPressure(points, (t) => 0.18 + 0.82 * Math.sin(Math.PI * t) ** 0.6),
      { ...reed, size: 3.8, flow: 0.9, taperStart: 0.12, taperEnd: 0.16 },
      { color: ink, seed: 11 },
    );
  return group;
}
export function hands(p: PanelHandle, stage: "find" | "repair" | "spark" | "lift", startFrame = 0) {
  let repairHand: LayerHandle | undefined,
    repairGear: LayerHandle | undefined,
    transfer: LayerHandle | undefined;
  let dormant: LayerHandle | undefined,
    ignition: LayerHandle | undefined,
    sparks: LayerHandle | undefined;
  const bg = p.addVectorLayer("Workbench darkness");
  contour(bg, "M 0 0 L 1280 0 L 1280 720 L 0 720 Z", "#283438");
  for (let i = 0; i < 20; i++)
    stroke(
      bg,
      [
        [0, 440 + i * 16],
        [430, 360 + i * 16],
        [1280, 300 + i * 16],
      ],
      1,
      "#485654",
    );
  supportingHand(p);
  if (stage === "repair" || stage === "spark") {
    repairHand = p.addGroup("Repair hand / tool contact pivot", {
      transform: { x: 609, y: 344.2 },
    });
    const r = p.addVectorLayer(
      "Repair hand / pinch and tool",
      { transform: { x: -609, y: -344.2 } },
      repairHand.id,
    );
    contour(
      r,
      "M 799 237 L 814 243 L 611 346 L 609 344.2 L 609 342 Z",
      "#bfc2ac",
      ink,
      2,
      "escapement-tool",
    );
    contour(r, "M 1280 85 L 1060 138 L 976 245 L 1064 364 L 1280 292 Z", "#697773");
    contour(r, "M 1060 136 L 1020 134 L 949 250 L 1007 290 L 1080 210 Z", paper);
    hatch(
      r,
      [
        [1048, 146],
        [1026, 144],
        [962, 246],
        [1004, 270],
      ],
      7,
      ink,
      -0.7,
    );
    contour(
      r,
      "M 954 214 Q 976 214 993 227 L 998 246 Q 995 262 983 265 Q 970 266 963 254 L 951 237 Z",
      paper,
      ink,
      2.2,
      "folded-little-finger",
    );
    contour(
      r,
      "M 923 220 Q 946 219 965 234 L 974 254 Q 973 270 959 278 Q 948 282 937 273 L 920 251 Z",
      paper,
      ink,
      2.4,
      "folded-ring-finger",
    );
    contour(
      r,
      "M 895 219 Q 918 216 940 237 L 939 257 Q 933 275 918 282 Q 905 287 894 277 L 882 261 Q 879 250 887 239 Z",
      paper,
      ink,
      2.6,
      "folded-middle-finger",
    );
    for (const d of [
      "M 888 256 Q 899 271 910 273 Q 922 273 936 260 Q 928 276 917 280 Q 905 283 897 275 Z",
      "M 937 259 Q 950 271 961 267 L 970 257 Q 966 274 956 276 Q 944 278 937 269 Z",
      "M 967 248 Q 979 259 991 250 Q 988 264 980 262 Q 973 261 967 254 Z",
    ])
      contour(r, d, "#9ca18f", "#9ca18f", 0.5);
    r.path(
      pathCommands(
        "M 891 253 Q 901 250 909 258 M 913 271 Q 920 264 923 256 M 939 250 Q 948 249 954 255 M 969 242 Q 977 243 981 248",
      ),
      { stroke: "#636c5e", strokeWidth: 1.2, name: "folded-knuckle-creases" },
    );
    contour(
      r,
      "M 1020 156 C 967 150 929 139 888 156 L 813 196 L 768 245 Q 762 260 779 263 L 801 253 L 839 217 L 883 205 Q 867 236 855 244 L 817 247 Q 801 248 801 259 Q 802 272 816 274 L 855 263 Q 881 258 898 245 L 930 225 L 963 246 L 1001 248 Z",
      paper,
      ink,
      4,
      "pinching-hand-contour",
    );
    contour(
      r,
      "M 935 181 L 900 199 L 879 243 Q 854 254 817 258 L 808 263 Q 811 270 823 267 L 862 259 L 901 242 L 932 227 L 961 244 L 1000 243 Z",
      "#9ca18f",
      "#9ca18f",
    );
    stroke(
      r,
      [
        [911, 164],
        [888, 188],
        [878, 207],
      ],
      2,
      ink,
    );
    stroke(
      r,
      [
        [968, 182],
        [962, 209],
        [973, 232],
      ],
      2,
      ink,
    );
    stroke(
      r,
      [
        [803, 240],
        [788, 240],
        [780, 251],
      ],
      1.5,
      ink,
    );
    stroke(
      r,
      [
        [821, 254],
        [813, 252],
        [807, 258],
      ],
      1.5,
      ink,
    );
    stroke(
      r,
      [
        [854, 238],
        [860, 246],
        [857, 251],
      ],
      1.2,
      ink,
    );
    stroke(
      r,
      [
        [838, 219],
        [845, 223],
        [848, 229],
      ],
      1.2,
      ink,
    );
  }
  if (stage === "spark") {
    dormant = insect(p, 609, 340, 0.84, false, false).group;
    ignition = insect(p, 609, 340, 0.84, true, true).group;
    ignition.set({ opacity: 0 });
  } else if (stage !== "lift") repairGear = insect(p, 609, 340, 0.84, false, false).gear;
  if (stage === "spark") {
    const source = p.addVectorLayer("Last light / source lantern");
    lantern(source, 1110, 666, 2.8, true);
    transfer = p.addGroup("Light carried into the escapement", { opacity: 0 });
    const filaments = p.addRasterLayer("Last light / traveling filaments", {}, transfer.id);
    for (const [index, d] of [
      "M 1118 624 C 1033 611 931 551 884 514 C 804 451 766 349 618 342",
      "M 1118 624 C 1031 574 945 558 906 514 C 826 423 755 336 618 342",
    ].entries()) {
      for (const points of samplePath(pathCommands(d), { step: 2 }))
        filaments.rasterStroke(
          points,
          { ...brushes.cleanInk, size: index === 0 ? 3 : 1, flow: 1, taperStart: 0, taperEnd: 0 },
          {
            color: index === 0 ? amber : "#fff1bf",
            seed: 20 + index,
            name: "light-transfer-filament",
            reveal: { startFrame, endFrame: startFrame + 8 },
          },
        );
    }
    const reflected = p.addVectorLayer(
      "First spark / hand bounce",
      { exposure: { startFrame: startFrame + 8, endFrame: startFrame + 36 } },
      transfer.id,
    );
    stroke(
      reflected,
      [
        [533, 348],
        [574, 330],
        [600, 328],
      ],
      2,
      amber,
    );
    stroke(
      reflected,
      [
        [623, 381],
        [652, 374],
        [673, 368],
      ],
      2,
      amber,
    );
    sparks = p.addVectorLayer("First sparks", { opacity: 0 });
    for (let i = 0; i < 11; i++) {
      const a = i * 2.4,
        r = 65 + i * 8;
      stroke(
        sparks,
        [
          [609 + Math.cos(a) * r, 339 + Math.sin(a) * r],
          [609 + Math.cos(a) * (r + 12), 339 + Math.sin(a) * (r + 12)],
        ],
        2,
        amber,
      );
    }
  }
  return { repairHand, repairGear, transfer, dormant, ignition, sparks };
}
