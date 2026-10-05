import {
  brushes,
  catmullRom,
  pathCommands,
  samplePath,
  withPressure,
  type LayerHandle,
  type PanelHandle,
} from "codeboard-studio";
import { contour, hatch, stroke } from "./marks.ts";
import { paper, ink, reed, amber } from "./palette.ts";
import { insect } from "./insect.ts";
import { lantern } from "./lantern.ts";
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
