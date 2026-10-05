import { pathCommands, type PanelHandle, type StoryboardProject } from "codeboard-studio";
import { amber, contour, ink, keeper, lantern, paper, stroke } from "./art.ts";
export function extinguishLantern(p: PanelHandle, board: StoryboardProject, start: number) {
  const chamber = p.addVectorLayer("Lantern chamber");
  contour(chamber, "M 0 0 L 1280 0 L 1280 720 L 0 720 Z", "#18272c");
  lantern(chamber, 637, 338, 4.1, false);
  const glass = p.addVectorLayer("Dying light / glass illumination");
  contour(glass, "M 539 166 L 626 166 L 626 488 Q 570 487 524 481 Z", amber, "transparent", 0);
  contour(glass, "M 649 166 L 735 166 L 750 481 Q 699 487 649 488 Z", amber, "transparent", 0);
  for (const [offset, opacity] of [
    [0, 0.8],
    [6, 0.65],
    [10, 0.78],
    [14, 0.45],
    [18, 0.18],
    [22, 0],
  ])
    board.production.addLayerKeyframe(glass.id, start + offset!, {
      opacity: opacity!,
      easing: "linear",
    });
  const weathered = p.addVectorLayer("Lantern / glass streaks and soot");
  contour(weathered, "M 542 170 L 554 170 L 546 273 L 536 315 Z", "#858778", "transparent", 0);
  contour(weathered, "M 548 327 L 540 394 L 535 421 L 540 334 Z", "#717b6d", "transparent", 0);
  contour(weathered, "M 716 177 L 727 177 L 730 217 L 725 209 Z", "#92917c", "transparent", 0);
  contour(weathered, "M 735 363 L 743 453 L 739 465 L 730 386 Z", "#697468", "transparent", 0);
  for (const [px, py, length] of [
    [568, 200, 23],
    [578, 277, 18],
    [688, 190, 28],
    [712, 324, 31],
    [584, 399, 19],
  ])
    stroke(
      weathered,
      [
        [px!, py!],
        [px! - 2, py! + length! * 0.7],
        [px! - 1, py! + length!],
      ],
      0.85,
      "#adb09b",
    );
  for (const [px, py] of [
    [549, 432],
    [554, 447],
    [560, 458],
    [573, 465],
    [691, 468],
    [706, 463],
    [719, 451],
  ])
    stroke(
      weathered,
      [
        [px!, py!],
        [px! + 5, py! + 3],
        [px! + 8, py! + 2],
      ],
      1.2,
      "#303b37",
    );
  weathered.set({ opacity: 0.65 });
  const wick = p.addVectorLayer("Lantern / wick and burner");
  contour(wick, "M 607 451 Q 637 457 665 450 L 661 462 Q 638 469 612 463 Z", ink);
  stroke(
    wick,
    [
      [637, 453],
      [637, 442],
    ],
    3,
    ink,
  );
  const drawings = [
    [
      0,
      6,
      "M 626 446 C 590 421 615 388 639 334 C 628 381 681 395 657 428 Q 650 448 626 446 Z",
      "M 633 444 Q 614 430 637 402 Q 650 424 643 444 Z",
    ],
    [
      6,
      10,
      "M 626 446 C 604 420 636 400 655 360 C 649 393 676 417 651 440 Q 640 450 626 446 Z",
      "M 632 444 Q 621 430 646 412 Q 650 432 641 445 Z",
    ],
    [
      10,
      13,
      "M 626 446 C 598 422 622 393 634 350 Q 630 385 652 404 Q 670 431 646 446 Z",
      "M 633 444 Q 620 427 638 404 Q 650 430 643 444 Z",
    ],
    [
      13,
      17,
      "M 629 446 C 615 430 634 419 637 395 Q 633 418 649 426 Q 651 446 629 446 Z",
      "M 633 445 Q 626 438 637 427 Q 645 439 641 446 Z",
    ],
    [
      17,
      22,
      "M 631 446 Q 624 438 635 433 Q 646 437 643 444 Q 637 448 631 446 Z",
      "M 634 445 Q 631 440 637 437 L 640 445 Z",
    ],
  ] as const;
  for (const [from, to, outer, core] of drawings) {
    const flame = p.addVectorLayer(`Last flame / drawing ${from}`, {
      exposure: { startFrame: start + from, endFrame: start + to },
    });
    contour(flame, outer, amber, "transparent", 0);
    contour(flame, core, "#fff1bf", "transparent", 0);
  }
}
export function placeLantern(p: PanelHandle, board: StoryboardProject, start: number) {
  const lamp = p.addGroup("Lantern / lowering to pavement");
  lantern(p.addVectorLayer("Lantern beside the puddle", {}, lamp.id), 1090, 600, 1.6);
  const hand = p.addGroup("Lantern / releasing hand");
  for (const released of [false, true]) {
    const drawing = p.addVectorLayer(`Lantern grip / ${released ? "open" : "closed"}`, {}, hand.id);
    contour(drawing, "M 1500 0 L 1164 339 L 1118 404 L 1174 454 L 1500 200 Z", "#677371");
    contour(drawing, "M 1164 339 L 1138 367 L 1113 408 L 1156 445 L 1180 409 Z", paper);
    for (let i = 0; i < 7; i++)
      stroke(
        drawing,
        [
          [1144 + i * 4, 367 + i * 6],
          [1124 + i * 4, 402 + i * 5],
        ],
        1,
        ink,
      );
    contour(
      drawing,
      released
        ? "M 1136 392 Q 1116 397 1100 416 L 1065 449 Q 1058 458 1066 462 Q 1073 466 1083 454 L 1105 437 L 1093 467 Q 1090 477 1098 479 Q 1108 480 1114 465 L 1127 444 L 1122 465 Q 1122 476 1131 473 L 1142 450 Q 1154 444 1161 429 Z"
        : "M 1136 392 Q 1110 398 1096 423 L 1076 446 Q 1066 451 1068 462 Q 1070 475 1081 476 L 1087 470 Q 1092 487 1102 480 Q 1111 486 1118 476 Q 1127 481 1133 469 L 1143 450 Q 1157 443 1161 429 Z",
      paper,
      ink,
      2.2,
    );
    if (released) {
      stroke(
        drawing,
        [
          [1110, 420],
          [1121, 425],
          [1130, 436],
        ],
        1.1,
        "#636c5e",
      );
    } else {
      contour(
        drawing,
        "M 1073 458 Q 1081 445 1093 447 L 1115 452 Q 1124 456 1120 464 Q 1117 470 1107 466 L 1090 461 Q 1085 474 1078 470 Z",
        paper,
        ink,
        1.8,
      );
      for (const [x, y] of [
        [1091, 467],
        [1105, 469],
        [1119, 463],
      ])
        stroke(
          drawing,
          [
            [x!, y! - 5],
            [x! + 3, y! + 3],
            [x! + 2, y! + 8],
          ],
          1.1,
          ink,
        );
    }
    board.production.setExposure(drawing.id, {
      startFrame: start + (released ? 14 : 0),
      endFrame: start + (released ? 30 : 14),
    });
  }
  for (const [offset, x, y] of [
    [0, -28, -142],
    [7, -6, -36],
    [12, 0, 0],
    [14, 0, 0],
  ]) {
    for (const group of [lamp, hand])
      board.production.addLayerKeyframe(group.id, start + offset!, {
        transform: { x: x!, y: y! },
        easing: "ease-in-out",
      });
  }
  board.production.addLayerKeyframe(hand.id, start + 20, {
    transform: { x: 55, y: -78 },
    easing: "ease-in-out",
  });
  board.production.addLayerKeyframe(hand.id, start + 29, {
    transform: { x: 240, y: -280 },
    easing: "ease-in-out",
  });
  return lamp;
}
type Expression = "down" | "resolve" | "wait" | "search" | "blink";
function expression(p: PanelHandle, parent: string, pose: Expression, waiting: boolean) {
  const layer = p.addVectorLayer(`Keeper / expression ${pose}`, {}, parent);
  const worried = pose === "wait" || pose === "search" || (pose === "blink" && waiting);
  stroke(
    layer,
    pose === "search"
      ? [
          [157, 84],
          [164, 85],
          [177, 93],
        ]
      : worried
        ? [
            [157, 85],
            [165, 85],
            [177, 91],
          ]
        : pose === "resolve"
          ? [
              [158, 87],
              [169, 88],
              [178, 88],
            ]
          : [
              [158, 86],
              [168, 88],
              [177, 92],
            ],
    2.8,
    ink,
  );
  if (pose === "blink") {
    stroke(
      layer,
      [
        [159, 95],
        [167, 98],
        [177, 96],
      ],
      2.2,
      ink,
    );
    stroke(
      layer,
      worried
        ? [
            [163, 127],
            [169, 125],
            [177, 128],
          ]
        : [
            [164, 126],
            [173, 127],
            [178, 125],
          ],
      worried ? 1.5 : 1.4,
      ink,
    );
    if (worried) {
      stroke(
        layer,
        [
          [174, 86],
          [177, 82],
        ],
        0.8,
        ink,
      );
      stroke(
        layer,
        [
          [162, 132],
          [168, 133],
        ],
        0.8,
        "#697463",
      );
    }
  } else {
    const eye =
      pose === "search"
        ? "M 159 97 Q 168 94 177 98 Q 169 103 159 97 Z"
        : worried
          ? "M 158 95 Q 167 90 177 96 Q 169 102 158 95 Z"
          : pose === "resolve"
            ? "M 158 96 Q 168 89 178 94 Q 170 101 158 96 Z"
            : "M 159 96 Q 168 92 178 98 Q 169 102 159 96 Z";
    contour(layer, eye, paper, ink, 1.2);
    const x = pose === "resolve" ? 173 : pose === "search" ? 174 : 170,
      y = pose === "resolve" ? 95.2 : pose === "search" ? 99.2 : worried ? 96.8 : 98;
    const pupil = contour(
      layer,
      `M ${x - 1.7} ${y} C ${x - 1.7} ${y - 3} ${x + 1.7} ${y - 3} ${x + 1.7} ${y} C ${x + 1.7} ${y + 3} ${x - 1.7} ${y + 3} ${x - 1.7} ${y} Z`,
      ink,
      ink,
      0.2,
    );
    layer.booleanPath(pupil, pathCommands(eye), "intersect");
    stroke(
      layer,
      [
        [162, 102],
        [170, 104],
        [175, 101],
      ],
      0.8,
      "#697463",
    );
    if (worried) {
      stroke(
        layer,
        pose === "search"
          ? [
              [163, 127],
              [169, 126],
              [177, 128],
            ]
          : [
              [163, 127],
              [169, 125],
              [177, 128],
            ],
        1.5,
        ink,
      );
      stroke(
        layer,
        [
          [174, 86],
          [177, 82],
        ],
        0.8,
        ink,
      );
      stroke(
        layer,
        [
          [162, 132],
          [168, 133],
        ],
        0.8,
        "#697463",
      );
    } else if (pose === "resolve")
      stroke(
        layer,
        [
          [163, 126],
          [169, 126],
          [177, 124],
        ],
        2,
        ink,
      );
    else
      stroke(
        layer,
        [
          [164, 126],
          [173, 127],
          [178, 125],
        ],
        1.4,
        ink,
      );
  }
  return layer;
}
/** Eye drawings and a small neck-pivot performance, all in the keeper's authored coordinates. */
export function closeupPerformance(
  p: PanelHandle,
  board: StoryboardProject,
  start: number,
  duration: number,
  waiting: boolean,
) {
  keeper(p, 8, -78, 3.65, "watch", false);
  const head = board.production.find({
    panelId: p.id,
    name: "Keeper / head and gaze",
    kind: "group",
  })[0]!;
  const exposures: [Expression, number, number][] = waiting
    ? [
        ["wait", 0, 18],
        ["blink", 18, 21],
        ["search", 21, duration],
      ]
    : [
        ["down", 0, 12],
        ["blink", 12, 15],
        ["resolve", 15, duration],
      ];
  for (const [pose, from, to] of exposures) {
    const drawing = expression(p, head.id, pose, waiting);
    board.production.setExposure(drawing.id, { startFrame: start + from, endFrame: start + to });
  }
  const keys = waiting
    ? [
        [0, 0.03],
        [17, 0.03],
        [26, 0.075],
        [duration - 1, 0.075],
      ]
    : [
        [0, 0.025],
        [11, 0.025],
        [19, -0.02],
        [28, 0.05],
        [duration - 1, 0.03],
      ];
  for (const [offset, angle] of keys) {
    const rotation = angle!;
    board.production.addLayerKeyframe(head.id, start + offset!, {
      transform: { rotation },
      easing: "ease-in-out",
    });
  }
}
