import type { LayerHandle, PanelHandle } from "codeboard-studio";
import { brushes } from "codeboard-studio";
import { hips } from "./poses.ts";
import type { DrawOptions, Point, Pose } from "./types.ts";
export const colors = {
  bg: "#10110e",
  paper: "#f5edda",
  orange: "#f48136",
  far: "#bf5728",
  black: "#10110e",
  muted: "#a69f8e",
};
export function poly(layer: LayerHandle, pts: Point[], fill?: string, stroke?: string, width = 1) {
  layer.path(
    [...pts.map(([x, y], i) => ({ op: i ? ("L" as const) : ("M" as const), x, y })), { op: "Z" }],
    { ...(fill ? { fill } : {}), ...(stroke ? { stroke, strokeWidth: width } : {}) },
  );
}
export function line(layer: LayerHandle, pts: Point[], color = colors.paper, width = 2) {
  layer.vectorStroke(
    pts.map(([x, y]) => ({ x, y, pressure: 1 })),
    { color, width, pressureSize: 0, taperStart: 0.12, taperEnd: 0.2 },
  );
}
export function inkLine(
  panel: PanelHandle,
  parent: string | undefined,
  pts: Point[],
  color = colors.paper,
  width = 3,
  seed = 13,
) {
  const layer = panel.addRasterLayer("Dry ink", {}, parent);
  layer.rasterStroke(
    pts.map(([x, y], i) => ({ x, y, pressure: 0.78 + (i % 3) * 0.1 })),
    { ...brushes.roughPencil, size: width, opacity: 1, flow: 0.8, textureStrength: 0.28 },
    { color, seed },
  );
  return layer;
}
export function text(
  panel: PanelHandle,
  value: string,
  x: number,
  y: number,
  size = 32,
  color = colors.paper,
  parent?: string,
  font = "Segoe Print",
  align: "left" | "center" | "right" = "left",
) {
  const l = panel.addVectorLayer(value, {}, parent);
  l.text(value, x, y, { color, font: `${size}px "${font}"`, align });
  return l;
}
export function ground(panel: PanelHandle, x1 = 170, x2 = 1740, y = 800, parent?: string) {
  inkLine(
    panel,
    parent,
    [
      [x1, y + 1],
      [x1 + (x2 - x1) * 0.32, y - 1],
      [x2, y],
    ],
    colors.paper,
    4,
  );
}
export function obstacle(panel: PanelHandle, x = 1070, y = 800, parent?: string) {
  inkLine(
    panel,
    parent,
    [
      [x - 7, y - 1],
      [x + 5, y - 22],
    ],
    colors.paper,
    5,
    26,
  );
}
export function legJoints(pose: Pose, i: number) {
  const hip = hips[i],
    foot = pose.feet[i];
  if (hip === undefined || !foot) throw new Error(`Missing leg ${i}`);
  const hipX = (hip * pose.w) / 206,
    hipY = pose.bottom - 10 + (i < 2 ? -8 : 0);
  const bend = (foot.x - hipX) * 0.45 + (i % 2 ? 5 : -5),
    kneeX = hipX + bend,
    kneeY = (hipY + foot.y) / 2;
  return { hipX, hipY, kneeX, kneeY, foot };
}
export function drawClawd(
  panel: PanelHandle,
  pose: Pose,
  {
    parent,
    x = 0,
    y = 0,
    scale = 1,
    rough = false,
    detail = true,
    opacity = 1,
    name = "Clawd drawing",
    exposure,
  }: DrawOptions = {},
) {
  const g = panel.addGroup(
    name,
    {
      transform: { x, y, scaleX: scale, scaleY: scale },
      opacity,
      ...(exposure ? { exposure } : {}),
    },
    parent,
  );
  const l = panel.addVectorLayer(
    rough ? "Construction contours" : "Selected ink contours",
    {},
    g.id,
  );
  const { w, h, bottom, lean, feet } = pose,
    top = bottom - h;
  const bodyPoint = (u: number, v: number): Point => [(u * w) / 2 + lean * -v, bottom + v * h];
  const contour = (
    [
      [-1, -0.06],
      [-1, -0.79],
      [-0.94, -0.79],
      [-0.94, -0.96],
      [-0.45, -0.96],
      [-0.45, -1],
      [0.75, -1],
      [0.75, -0.975],
      [0.97, -0.975],
      [1, -0.1],
      [0.9, -0.1],
      [0.9, 0],
      [-0.87, 0],
      [-0.87, -0.055],
    ] as const
  ).map(([u, v]) => bodyPoint(u, v));
  // All four legs are separate contours. Far legs paint first and are naturally occluded.
  for (const i of [0, 1, 2, 3] as const) {
    const { hipX, hipY, kneeX, kneeY, foot } = legJoints(pose, i);
    const leg: Point[] = [
      [hipX - 12, hipY],
      [hipX + 15, hipY],
      [kneeX + 13, kneeY],
      [foot.x + 16, foot.y - 8],
      [foot.x + 13, foot.y],
      [foot.x - 13, foot.y],
      [foot.x - 18, foot.y - 7],
      [kneeX - 12, kneeY - 1],
    ];
    poly(
      l,
      leg,
      rough ? undefined : i < 2 ? colors.far : colors.orange,
      rough ? colors.paper : undefined,
      rough ? 1.8 : 0,
    );
    if (rough)
      line(
        l,
        [
          [hipX, hipY],
          [kneeX, kneeY],
          [foot.x, foot.y],
        ],
        colors.muted,
        1,
      );
  }
  poly(
    l,
    contour,
    rough ? undefined : colors.orange,
    rough ? colors.paper : undefined,
    rough ? 2 : 0,
  );
  if (rough) {
    line(
      l,
      [
        [-w * 0.48, top + h * 0.48],
        [w * 0.48, top + h * 0.48],
      ],
      colors.muted,
      1,
    );
    line(
      l,
      [
        [lean, top - 8],
        [0, bottom + 8],
      ],
      colors.muted,
      1,
    );
    poly(
      l,
      contour.map(([x, y], i) => [x + (i % 2 ? 3 : -2), y + 3]),
      undefined,
      colors.muted,
      1,
    );
  } else {
    // Reproducible little chips follow the contour; no frame-random texture.
    for (let e = 0; e < contour.length; e++) {
      const a = contour[e],
        b = contour[(e + 1) % contour.length];
      if (!a || !b) throw new Error("Incomplete body contour");
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        len = Math.hypot(dx, dy);
      if (len < 18) continue;
      for (let k = 0; k < Math.floor(len / 23); k++) {
        const t = (k + 0.35) / (Math.floor(len / 23) + 0.2),
          px = a[0] + dx * t,
          py = a[1] + dy * t;
        const nx = -dy / len,
          ny = dx / len;
        poly(
          l,
          [
            [px - (dx / len) * 2.5, py - (dy / len) * 2.5],
            [px + (dx / len) * 3, py + (dy / len) * 3],
            [px + nx * 1.6, py + ny * 1.6],
          ],
          colors.bg,
        );
      }
    }
    const edgeStart = contour[3],
      edgeEnd = contour[5];
    if (!edgeStart || !edgeEnd) throw new Error("Missing upper body edge");
    line(
      l,
      [
        [edgeStart[0] + 8, edgeStart[1] + 4],
        [edgeEnd[0] - 5, edgeEnd[1] + 4],
      ],
      colors.far,
      1.4,
    );
  }
  if (!rough && detail) {
    const ink = panel.addVectorLayer("Body ink / stable surface hatching", {}, g.id);
    const stroke = (pts: Point[], color: string, width: number) =>
      ink.path(
        pts.map(([x, y], i) => ({ op: i ? ("L" as const) : ("M" as const), x, y })),
        { stroke: color, strokeWidth: width },
      );
    for (const [u, v, length] of [
      [-0.85, -0.79, 0.16],
      [-0.81, -0.48, 0.11],
      [-0.65, -0.9, 0.09],
      [-0.6, -0.37, 0.07],
      [-0.38, -0.84, 0.05],
      [-0.2, -0.18, 0.08],
      [0.04, -0.89, 0.07],
      [0.65, -0.16, 0.05],
    ] as const) {
      stroke([bodyPoint(u, v), bodyPoint(u - 0.045, v + length)], "#bb5627", 1.25);
    }
    stroke(
      [bodyPoint(-0.85, -0.93), bodyPoint(-0.4, -0.945), bodyPoint(0.55, -0.93)],
      "#ffc078",
      1.7,
    );
    stroke([bodyPoint(-0.81, -0.11), bodyPoint(-0.57, -0.09)], "#bd5829", 1.8);
    for (const i of [2, 3] as const) {
      const f = feet[i];
      if (!f) throw new Error(`Missing foot ${i}`);
      stroke(
        [
          [f.x - 9, f.y - 6],
          [f.x + 8, f.y - 5],
        ],
        "#bd5829",
        1.5,
      );
    }
  }
  const eh = 26 * pose.eye,
    ey = top + h * 0.4 + (26 - eh) / 2;
  for (const ex of [w * 0.22, w * 0.39] as const) {
    const xx = ex + lean * 0.6 + pose.gaze;
    if (eh < 4)
      line(
        l,
        [
          [xx - 5, ey],
          [xx + 5, ey],
        ],
        rough ? colors.paper : colors.black,
        2.2,
      );
    else
      poly(
        l,
        [
          [xx - 4, ey],
          [xx + 3, ey - 1],
          [xx + 5, ey + eh - 3],
          [xx + 2, ey + eh],
          [xx - 4, ey + eh - 1],
          [xx - 5, ey + 3],
        ],
        rough ? colors.paper : colors.black,
      );
  }
  return g;
}
