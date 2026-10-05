import {
  catmullRom,
  pathCommands,
  type LayerHandle,
  type PanelHandle,
  type StoryboardProject,
} from "codeboard-studio";
import { amber, contour, dry, hatch, ink, keeper, paper, stroke } from "./art.ts";
type XY = [number, number];
const project = (x: number, z: number, height = 0): XY => [
  872 + (700 * x) / z,
  302 + (700 * (160 - height)) / z,
];
const polygon = (layer: LayerHandle, points: XY[], fill: string, width = 1.5) =>
  contour(layer, `M ${points.map((p) => p.join(" ")).join(" L ")} Z`, fill, ink, width);
function exposedMasonry(wall: LayerHandle, x: number, near: number, far: number, bottom: number) {
  const at = (u: number, h: number) => project(x, near + (far - near) * u, bottom + h);
  const outline = [
    [0, 12],
    [0.12, 19],
    [0.08, 38],
    [0.23, 47],
    [0.18, 67],
    [0.37, 78],
    [0.41, 99],
    [0.58, 103],
    [0.64, 89],
    [0.88, 92],
    [0.82, 68],
    [1, 59],
    [0.91, 39],
    [0.98, 22],
    [0.73, 26],
    [0.66, 9],
    [0.43, 15],
    [0.3, 0],
  ].map(([u, h]) => at(u!, h!));
  const boundary = pathCommands(`M ${outline.map((point) => point.join(" ")).join(" L ")} Z`);
  wall.path(boundary, {
    fill: x < 0 ? "#394b43" : "#293d36",
    stroke: x < 0 ? "#6e7667" : "#4b5a4c",
    strokeWidth: 0.65,
    name: "exposed-masonry-boundary",
  });
  const colors = x < 0 ? ["#64665a", "#555c51", "#4b554d"] : ["#3d4c43", "#455449", "#33483c"];
  const width = (far - near) / 3.4;
  for (let row = 0; row < 8; row++)
    for (let column = -1; column < 5; column++) {
      const z = near + (column + (row % 2) * 0.5) * width,
        h = bottom + row * 14;
      const points = [
        project(x, z + 1, h + 1),
        project(x, z + width - 2, h + 1),
        project(x, z + width - 2, h + 12),
        project(x, z + 1, h + 12),
      ];
      const id = wall.path(
        pathCommands(`M ${points.map((point) => point.join(" ")).join(" L ")} Z`),
        { fill: colors[(row + column + 3) % 3]!, strokeWidth: 0, name: "exposed-brick" },
      );
      wall.booleanPath(id, boundary, "intersect");
    }
}
function shopfront(
  wall: LayerHandle,
  dark: LayerHandle,
  x: number,
  z0: number,
  z1: number,
  side: number,
) {
  const rect = (near: number, far: number, bottom: number, top: number, color: string) =>
    polygon(
      wall,
      [
        project(x, near, bottom),
        project(x, far, bottom),
        project(x, far, top),
        project(x, near, top),
      ],
      color,
      1.2,
    );
  const a = z0 + 26,
    b = z1 - 17,
    door = a + (b - a) * 0.66;
  rect(a, b, 0, 92, "#202d2e");
  rect(a + 8, door - 8, 24, 79, "#d8aa5e");
  rect(door + 7, b - 7, 11, 77, "#ab915a");
  for (const [near, far, bottom, top] of [
    [a + 8, door - 8, 33, 79],
    [door + 7, b - 7, 11, 77],
  ])
    polygon(
      dark,
      [
        project(x, near!, bottom!),
        project(x, far!, bottom!),
        project(x, far!, top!),
        project(x, near!, top!),
      ],
      "#101c1d",
      0,
    );
  rect(a + 8, door - 8, 24, 33, ink);
  for (let n = 1; n < 4; n++) {
    const z = a + 8 + ((door - a - 16) * n) / 4;
    stroke(wall, [project(x, z, 33), project(x, z, 78)], 2, ink);
  }
  stroke(wall, [project(x, door + 12, 45), project(x, door + 17, 45)], 2, paper);
  for (const z of [a, door, b]) stroke(wall, [project(x, z, 0), project(x, z, 94)], 3, ink);
  if (side > 0) {
    rect(a - 6, b + 6, 87, 103, "#88917d");
    for (const z of [a - 4, b + 4])
      stroke(wall, [project(x, z, 0), project(x, z, 104)], 4.5, "#87907c");
    for (let n = 0; n < 5; n++) {
      const z = a + 12 + (n * (door - a - 23)) / 5;
      polygon(
        wall,
        [
          project(x, z, 33),
          project(x, z + 8, 33),
          project(x, z + 7, 42 + (n % 3) * 5),
          project(x, z + 2, 43 + (n % 3) * 5),
        ],
        ink,
        0.5,
      );
    }
    const signX = x - 21,
      signZ = z0 + 17;
    stroke(
      wall,
      [project(x, signZ, 130), project(signX, signZ, 132), project(signX - 12, signZ, 127)],
      2.5,
      ink,
    );
    polygon(
      wall,
      [
        project(signX - 4, signZ, 127),
        project(signX - 24, signZ, 127),
        project(signX - 24, signZ, 107),
        project(signX - 4, signZ, 107),
      ],
      "#a9ae94",
      1.5,
    );
    stroke(
      wall,
      [
        project(signX - 9, signZ, 113),
        project(signX - 9, signZ, 121),
        project(signX - 19, signZ, 121),
      ],
      1.4,
      ink,
    );
    return;
  }
  // A canvas awning projects over the pavement, with its valance below the front edge.
  const edge = x - side * 34;
  polygon(
    wall,
    [
      project(x, a - 6, 94),
      project(x, b + 6, 94),
      project(edge, b + 6, 79),
      project(edge, a - 6, 79),
    ],
    "#747c6d",
    2,
  );
  for (let n = 0; n < 6; n++) {
    const near = a - 6 + ((b - a + 12) * n) / 6,
      far = near + (b - a + 12) / 6;
    if (n % 2 === 0)
      polygon(
        wall,
        [
          project(x, near, 94),
          project(x, far, 94),
          project(edge, far, 79),
          project(edge, near, 79),
        ],
        "#bac0a7",
        0.5,
      );
    const p0 = project(edge, near, 79),
      p1 = project(edge, far, 79),
      mid = project(edge, (near + far) / 2, 68);
    contour(
      wall,
      `M ${p0.join(" ")} L ${p1.join(" ")} Q ${mid.join(" ")} ${p0.join(" ")} Z`,
      n % 2 === 0 ? "#b3b89d" : "#606a5f",
      ink,
      1,
    );
  }
  stroke(wall, [project(x, a, 4), project(edge, a, 0), project(edge, b, 0)], 2.4, "#a7ad97");
}
/** A second authored viewpoint: looking out from shelter, along the illuminated street. */
export function payoff(p: PanelHandle, board: StoryboardProject, start: number) {
  const sky = p.addVectorLayer("Payoff / paper sky", { depth: 5 });
  contour(sky, "M 0 0 L 1280 0 L 1280 720 L 0 720 Z", "#354044", "#354044");
  contour(
    sky,
    "M 0 76 C 195 149 280 35 451 88 C 582 141 655 96 742 106 Q 844 126 956 62 C 1084 4 1192 94 1280 45 L 1280 0 L 0 0 Z",
    "#253236",
    "#253236",
  );
  for (let i = 0; i < 17; i++)
    stroke(
      sky,
      [
        [447 + i * 15, 41 + i * 2],
        [650 + i * 8, 82 + i * 2],
        [868 + i * 5, 46 + i * 3],
      ],
      0.8,
      "#435051",
    );
  const distant = p.addVectorLayer("Payoff / towers beyond the street", { depth: 3 });
  for (const [x, z, height, width] of [
    [-470, 2100, 430, 160],
    [-230, 2000, 320, 100],
    [-40, 2300, 545, 140],
    [175, 2200, 420, 160],
    [385, 2050, 355, 140],
  ]) {
    const left = x! - width! / 2,
      right = x! + width! / 2;
    polygon(
      distant,
      [
        project(left, z!, 0),
        project(left, z!, height! - 35),
        project(x! - 24, z!, height! - 35),
        project(x!, z!, height!),
        project(x! + 23, z!, height! - 35),
        project(right, z!, height! - 35),
        project(right, z!, 0),
      ],
      "#424e4d",
      0.7,
    );
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 3; col++) {
        const xx = left + 26 + (col * width!) / 4,
          hh = 55 + row * 57;
        if (hh + 28 > height! - 40) continue;
        polygon(
          distant,
          [
            project(xx, z!, hh),
            project(xx + 13, z!, hh),
            project(xx + 13, z!, hh + 26),
            project(xx, z!, hh + 26),
          ],
          (row + col) % 3 ? "#747b68" : amber,
          0.4,
        );
      }
  }
  const street = p.addVectorLayer("Payoff / wet paving", { depth: 1 });
  polygon(
    street,
    [
      [0, 390],
      [872, 346],
      [1280, 390],
      [1280, 720],
      [0, 720],
    ],
    "#394644",
  );
  polygon(
    street,
    [project(-215, 1800), project(210, 1800), project(210, 240), project(-215, 240)],
    "#424e4c",
  );
  for (const x of [-210, -135, -55, 25, 110, 205])
    stroke(street, [project(x, 1800), project(x, 750), project(x, 245)], 1.3, "#34433e");
  for (let z = 280; z < 1800; z += 70 + z * 0.09) {
    const left = project(-215, z),
      right = project(210, z);
    stroke(street, [left, [(left[0] + right[0]) / 2, left[1] - 2], right], 1.2, "#536156");
  }
  // Staggered setts follow the same ground projection as the facades and reflections.
  for (let row = 0; row < 24; row++) {
    const z = 278 + row * 37;
    for (let col = 0; col < 9; col++) {
      const x = -202 + col * 47 + (row % 2) * 23.5;
      if (x > 192) continue;
      const corners = [
        project(x, z),
        project(x + 39, z + 2),
        project(x + 41, z + 29),
        project(x + 2, z + 31),
      ];
      if (corners.every(([, y]) => y > 725)) continue;
      const shade = (row + col * 2) % 7;
      if (shade === 0 || shade === 3)
        polygon(street, corners, shade === 0 ? "#3c4945" : "#505b50", 0.35);
      const a = corners[0]!,
        b = corners[1]!,
        c = corners[2]!;
      stroke(street, [[a[0] + 3, a[1]], [(a[0] + b[0]) / 2, a[1] - 0.7], b], 0.85, "#303e38");
      if ((row + col) % 3 !== 0) stroke(street, [b, c], 0.7, "#37483f");
    }
  }
  contour(
    street,
    "M 594 512 C 630 499 717 508 743 520 L 806 521 Q 834 529 788 535 L 685 535 L 705 540 Q 638 549 585 541 L 619 532 L 556 529 Z",
    "#55665d",
    "#55665d",
    0.5,
  );
  contour(
    street,
    "M 828 593 Q 884 578 951 588 L 1000 582 L 1087 597 L 1053 608 L 1108 615 Q 1000 631 925 617 L 869 623 L 798 610 L 853 605 Z",
    "#44574c",
    "#44574c",
    0.5,
  );
  contour(
    street,
    "M 339 682 Q 404 662 492 675 L 567 664 L 632 679 L 696 678 L 729 690 L 664 700 L 706 711 L 398 717 L 411 704 L 336 699 Z",
    "#374d42",
    "#374d42",
    0.5,
  );
  stroke(
    street,
    [
      [583, 527],
      [640, 532],
      [702, 530],
      [751, 530],
    ],
    1.1,
    paper,
  );
  stroke(
    street,
    [
      [827, 608],
      [873, 613],
      [921, 608],
    ],
    1.4,
    paper,
  );
  stroke(
    street,
    [
      [397, 693],
      [451, 686],
      [511, 688],
    ],
    1.6,
    paper,
  );
  const reflections = p.addGroup("Payoff / window reflections", { depth: 1 });
  // Reflect actual window centres below the ground plane, then break their images into ripples.
  const reflect = (reflected: LayerHandle, x: number, z: number, height: number, width: number) => {
    const half = Math.abs(project(x, z - width / 2)[0] - project(x, z + width / 2)[0]) * 0.5;
    for (let i = 0; i < 13; i++) {
      const [cx, py] = project(x, z, -height - 18 + i * 3);
      if (py > 720 || py < 365) continue;
      const ripple = Math.sin(py * 0.073 + z * 0.004),
        px = cx + ripple * Math.min(6, 2100 / z);
      const reach = half * (1.8 + 0.6 * Math.cos(i * 0.9));
      const color = i % 4 === 0 ? "#b3945c" : i % 3 === 0 ? "#f2ce83" : amber;
      const gap = reach * (0.1 + 0.16 * Math.abs(ripple));
      const thickness = Math.max(1.1, Math.min(3.2, 2100 / z)) * (i % 3 === 0 ? 0.65 : 1);
      stroke(
        reflected,
        [
          [px - reach, py],
          [px - gap, py + 0.6],
        ],
        thickness,
        color,
      );
      if (i % 4 !== 1)
        stroke(
          reflected,
          [
            [px + gap, py + 0.3],
            [px + reach * 0.85, py - 0.4],
          ],
          thickness * 0.8,
          color,
        );
    }
  };
  const spans = [350, 560, 810, 1110, 1480, 1880];
  for (const side of [-1, 1])
    for (let index = spans.length - 2; index >= 0; index--) {
      const z0 = spans[index]!,
        z1 = spans[index + 1]!,
        x = side * (side < 0 ? 260 : 245),
        height = (side < 0 ? [430, 345, 385, 285, 320] : [398, 372, 306, 350, 275])[index]!;
      const wall = p.addVectorLayer(`Payoff / ${side < 0 ? "left" : "right"} facade ${index + 1}`, {
        depth: 1.4,
      });
      const label = `${side < 0 ? "left" : "right"} ${index + 1}`;
      const dark = p.addVectorLayer(`Payoff / unlit windows ${label}`, { depth: 1.4 });
      const reflected = p.addVectorLayer(`Payoff / reflected light ${label}`, {}, reflections.id);
      const onset = (4 - index) * 7 + (side > 0 ? 4 : 0),
        end = onset + 6;
      for (const [offset, opacity] of [
        [0, 1],
        [onset, 1],
        [end, 0],
      ])
        board.production.addLayerKeyframe(dark.id, start + offset!, {
          opacity: opacity!,
          easing: "linear",
        });
      for (const [offset, opacity] of [
        [0, 0],
        [onset, 0],
        [end, 1],
      ])
        board.production.addLayerKeyframe(reflected.id, start + offset!, {
          opacity: opacity!,
          easing: "linear",
        });
      const face = [project(x, z0), project(x, z1), project(x, z1, height), project(x, z0, height)];
      const wallColors =
        side < 0
          ? ["#535e57", "#3f514c", "#5a6259", "#3c4b48", "#4a5751"]
          : ["#25312f", "#394a43", "#303e3d", "#414d46", "#2d3e3c"];
      polygon(wall, face, wallColors[index]!, 2);
      if (index < 3) {
        const point = (u: number, h: number) => project(x, z0 + (z1 - z0) * u, h).join(" ");
        contour(
          wall,
          `M ${point(0.28, 0)} L ${point(0.28, 38)} Q ${point(0.38, 57)} ${point(0.45, 40)} L ${point(0.51, 62)} Q ${point(0.63, 48)} ${point(0.69, 68)} L ${point(0.79, 52)} L ${point(1, 64)} L ${point(1, 0)} Z`,
          side < 0 ? "#394b45" : "#1d302d",
          "transparent",
          0,
        );
        contour(
          wall,
          `M ${point(0.42, height - 21)} L ${point(0.44, height - 80)} Q ${point(0.5, height - 106)} ${point(0.52, height - 74)} L ${point(0.55, height - 43)} Q ${point(0.64, height - 69)} ${point(0.68, height - 22)} Z`,
          side < 0 ? "#647064" : "#43564b",
          "transparent",
          0,
        );
        for (const [u, h, length] of [
          [0.32, 108, 26],
          [0.72, 193, 33],
          [0.55, 267, 21],
        ]) {
          if (h! + length! > height - 25) continue;
          stroke(
            wall,
            [
              project(x, z0 + (z1 - z0) * u!, h!),
              project(x, z0 + (z1 - z0) * (u! + 0.035), h! + length! * 0.4),
              project(x, z0 + (z1 - z0) * (u! + 0.02), h! + length!),
            ],
            1.1,
            side < 0 ? "#283c35" : "#607361",
          );
        }
      }
      if (side < 0 && index === 0)
        exposedMasonry(wall, x, z0 + (z1 - z0) * 0.37, z0 + (z1 - z0) * 0.75, 61);
      if (side > 0 && index === 1)
        exposedMasonry(wall, x, z0 + (z1 - z0) * 0.2, z0 + (z1 - z0) * 0.66, 108);
      const shadowWidth = (z1 - z0) * 0.14;
      const shadow = [
        project(x, z0),
        project(x, z0 + shadowWidth),
        project(x, z0 + shadowWidth, height),
        project(x, z0, height),
      ];
      polygon(wall, shadow, ink, 1);
      for (const hh of [14, height - 18, height])
        stroke(
          wall,
          [project(x, z0, hh), project(x, z1, hh)],
          hh === height ? 5 : 2,
          hh === height ? ink : paper,
        );
      const columns = index === 1 ? 2 : index === 0 ? 3 : 2;
      const floors =
        index === 1
          ? [26, 132, 222, 306].filter((h) => h + 39 < height - 20)
          : Array.from({ length: Math.floor(height / 72) }, (_, row) => 28 + row * 72);
      for (const [row, h] of floors.entries())
        for (let col = 0; col < columns; col++) {
          if (index === 1 && row === 0) continue;
          const z = z0 + ((col + 0.35) * (z1 - z0)) / columns,
            w = ((z1 - z0) / columns) * (index === 1 ? 0.61 : 0.48);
          const lit = (row * 3 + col + index + (side > 0 ? 1 : 0)) % 5 !== 0;
          if (row === 0 && col === 1 && (index === 0 || index === 2)) {
            const a = project(x, z, 0),
              b = project(x, z, 64),
              c = project(x, z + w / 2, 93),
              d = project(x, z + w, 64),
              e = project(x, z + w, 0);
            contour(
              wall,
              `M ${a.join(" ")} L ${b.join(" ")} Q ${c.join(" ")} ${d.join(" ")} L ${e.join(" ")} Z`,
              ink,
              ink,
              2,
            );
            stroke(wall, [project(x, z + 3, 58), project(x, z + w - 3, 58)], 2, paper);
            stroke(wall, [project(x, z + w / 2, 0), project(x, z + w / 2, 76)], 1, "#798377");
            continue;
          }
          polygon(
            wall,
            [
              project(x, z, h),
              project(x, z + w, h),
              project(x, z + w, h + 39),
              project(x, z, h + 39),
            ],
            ink,
            2,
          );
          const windowLight = [amber, "#d49d50", "#e2b771", "#efd18c"][
            (row + col * 2 + index) % 4
          ]!;
          polygon(
            wall,
            [
              project(x, z + 3, h + 3),
              project(x, z + w - 3, h + 3),
              project(x, z + w - 3, h + 35),
              project(x, z + 3, h + 35),
            ],
            lit ? windowLight : "#0f1c1d",
            0.5,
          );
          if (lit)
            polygon(
              dark,
              [
                project(x, z + 3, h + 3),
                project(x, z + w - 3, h + 3),
                project(x, z + w - 3, h + 35),
                project(x, z + 3, h + 35),
              ],
              "#101c1d",
              0,
            );
          if (lit && index < 2) {
            const curtain = z + 3 + w * 0.18;
            polygon(
              wall,
              [
                project(x, z + 3, h + 3),
                project(x, curtain, h + 7),
                project(x, curtain + w * 0.08, h + 21),
                project(x, curtain, h + 35),
                project(x, z + 3, h + 35),
              ],
              "#aa874d",
              0.35,
            );
          }
          stroke(wall, [project(x, z + w / 2, h), project(x, z + w / 2, h + 39)], 1.4, ink);
          stroke(wall, [project(x, z, h + 17), project(x, z + w, h + 17)], 1, ink);
          if (index === 0 && side < 0 && row > 1) {
            const left = project(x, z - 2, h + 40),
              crown = project(x, z + w / 2, h + 61),
              right = project(x, z + w + 2, h + 40);
            contour(
              wall,
              `M ${left.join(" ")} Q ${crown.join(" ")} ${right.join(" ")}`,
              "transparent",
              paper,
              2,
            );
            stroke(wall, [project(x, z - 2, h + 40), project(x, z - 2, h + 34)], 2.2, paper);
          }
          if (index === 1 && side > 0) {
            for (const [near, far] of [
              [z - 12, z - 3],
              [z + w + 3, z + w + 13],
            ]) {
              polygon(
                wall,
                [
                  project(x, near!, h),
                  project(x, far!, h),
                  project(x, far!, h + 39),
                  project(x, near!, h + 39),
                ],
                "#6e7869",
                1,
              );
              for (let slat = 4; slat < 38; slat += 6)
                stroke(wall, [project(x, near!, h + slat), project(x, far!, h + slat)], 0.9, ink);
            }
          }
          stroke(
            wall,
            [project(x - side * 4, z - 3, h - 3), project(x - side * 4, z + w + 3, h - 3)],
            2.2,
            side < 0 ? paper : ink,
          );
          if (lit && row < 3) reflect(reflected, x, z + w / 2, h + 20, w);
          if (index === 0 && row === 2 && col === 1) {
            const edge = x - side * 22;
            polygon(
              wall,
              [
                project(x, z - 6, h - 5),
                project(x, z + w + 6, h - 5),
                project(edge, z + w + 6, h - 5),
                project(edge, z - 6, h - 5),
              ],
              ink,
              1.5,
            );
            stroke(
              wall,
              [project(edge, z - 6, h + 19), project(edge, z + w + 6, h + 19)],
              2.6,
              ink,
            );
            for (let n = 0; n < 7; n++) {
              const zz = z - 6 + ((w + 12) * n) / 6;
              stroke(wall, [project(edge, zz, h - 5), project(edge, zz, h + 19)], 1.6, ink);
            }
          }
        }
      if (index === 1) {
        shopfront(wall, dark, x, z0, z1, side);
        polygon(
          reflected,
          [
            project(x, z0 + 26),
            project(x, z1 - 17),
            project(x - side * 80, z1 + 30),
            project(x - side * 95, z0 + 10),
          ],
          "#68674c",
          0.2,
        );
        reflect(reflected, x, z0 + (z1 - z0) * 0.42, 52, (z1 - z0) * 0.45);
      }
      if (index < 2) {
        hatch(wall, shadow, 5, side < 0 ? "#bac0ab" : "#778074", side < 0 ? -0.7 : 0.9, 0.8);
        const topBand = [
          project(x, z0 + shadowWidth, height - 52),
          project(x, z1, height - 52),
          project(x, z1, height - 20),
          project(x, z0 + shadowWidth, height - 20),
        ];
        hatch(wall, topBand, 5, ink, -0.65, 0.9);
        for (let row = 0; row < 4; row++) {
          const a = project(x, z0 + shadowWidth, 45 + row * 72),
            b = project(x, z1, 45 + row * 72);
          stroke(
            wall,
            [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 1], b],
            0.9,
            side < 0 ? "#c3c5b1" : "#718074",
          );
        }
      }
      const seam = project(x, z0, 0),
        top = project(x, z0, height + 30);
      stroke(wall, [top, [seam[0], seam[1] - 16], seam], 3, ink);
    }
  const wires = p.addVectorLayer("Payoff / suspended cables", { depth: 1.4 });
  for (let i = 0; i < 3; i++)
    stroke(
      wires,
      [
        [360, 90 + i * 8],
        [650, 189 + i * 6],
        [900, 148 + i * 8],
        [1160, 77 + i * 10],
      ],
      1.2,
      ink,
    );
  // A worn arch supplies a dark foreground and separates the keeper from the restored city.
  const arch = p.addVectorLayer("Payoff / shelter arch", { depth: 0.65 });
  contour(
    arch,
    "M 0 0 L 1280 0 L 1280 35 C 917 4 651 15 399 100 Q 207 173 166 331 L 143 720 L 0 720 Z",
    ink,
  );
  contour(
    arch,
    "M 70 0 L 394 0 Q 179 138 119 300 L 93 720 L 46 720 L 68 286 Q 103 155 220 66 Z",
    "#424b47",
    ink,
    2,
  );
  stroke(
    arch,
    [
      [166, 323],
      [192, 248],
      [251, 173],
      [345, 112],
      [457, 72],
      [594, 45],
    ],
    3,
    paper,
  );
  hatch(
    arch,
    [
      [68, 335],
      [115, 318],
      [91, 701],
      [46, 720],
    ],
    6,
    "#899285",
    -0.75,
    1,
  );
  for (let y = 83; y < 660; y += 61)
    stroke(
      arch,
      [
        [57, y],
        [114, y + 16],
      ],
      2,
      ink,
    );
  const scraped = p.addRasterLayer("Payoff / dry ink on stone", { depth: 0.65 });
  for (let i = 0; i < 7; i++)
    scraped.rasterStroke(
      catmullRom(
        [
          { x: 126 + i * 9, y: 220 - i * 13, pressure: 0.2 },
          { x: 110 + i * 6, y: 304, pressure: 0.65 },
          { x: 93 + i * 5, y: 402 + i * 11, pressure: 0.1 },
        ],
        9,
      ),
      { ...dry, size: 21 },
      { color: "#8e9687", seed: 310 + i },
    );
  keeper(p, 134, 82, 1.02, "look-up", false);
  const lightEdge = p.addVectorLayer("Payoff / returned light on coat");
  stroke(
    lightEdge,
    [
      [322, 268],
      [330, 323],
      [320, 385],
      [312, 461],
    ],
    2,
    amber,
  );
  for (const [offset, opacity] of [
    [0, 0],
    [28, 0],
    [38, 1],
  ])
    board.production.addLayerKeyframe(lightEdge.id, start + offset!, {
      opacity: opacity!,
      easing: "linear",
    });
  return { firefly: { x: 843, y: 114 } };
}
