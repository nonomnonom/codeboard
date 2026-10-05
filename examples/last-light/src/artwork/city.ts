import { catmullRom, type PanelHandle } from "codeboard-studio";
import { contour, stroke, hatch } from "./marks.ts";
import { amber, ink, dry } from "./palette.ts";
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
