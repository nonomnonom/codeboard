import type { LayerHandle, PanelHandle, StoryboardProject } from "codeboard-studio";
import assert from "node:assert/strict";
import { colors, drawClawd, ground, legJoints, poly, text } from "../../character/art.ts";
import { at, drawing } from "../../character/poses.ts";
import type { Point } from "../../character/types.ts";
import { penNib } from "./props.ts";
const label = (
  p: PanelHandle,
  s: string,
  x: number,
  y: number,
  size = 27,
  color = colors.paper,
  parent?: string,
) => text(p, s, x, y, size, color, parent, "Consolas");
const path = (l: LayerHandle, pts: Point[], color = colors.paper, width = 2) =>
  l.path(
    pts.map(([x, y], i) => ({ op: i ? ("L" as const) : ("M" as const), x, y })),
    { stroke: color, strokeWidth: width },
  );
const dot = (l: LayerHandle, x: number, y: number, r = 4, color = colors.orange) =>
  poly(
    l,
    Array.from({ length: 12 }, (_, i) => [
      x + r * Math.cos((i * Math.PI) / 6),
      y + r * Math.sin((i * Math.PI) / 6),
    ]),
    colors.bg,
    color,
    1.5,
  );
export function inkAction(
  b: StoryboardProject,
  p: PanelHandle,
  points: Point[],
  start: number,
  end: number,
  {
    color = colors.orange,
    width = 3,
    pen = true,
    parent,
  }: {
    color?: string;
    width?: number;
    pen?: boolean;
    parent?: string;
  } = {},
) {
  const track = p.addGroup("Ink being drawn", {}, parent),
    keys = [];
  const firstPoint = points[0];
  assert.ok(
    firstPoint && points.length > 1 && end > start,
    "Ink action needs a path and a positive duration",
  );
  const segments = points.slice(1).map((to, i) => {
    const from = points[i];
    assert.ok(from);
    return { from, to, length: Math.hypot(to[0] - from[0], to[1] - from[1]) };
  });
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  const penExposure = pen
    ? p.addGroup(
        "Pen action exposure",
        { exposure: { startFrame: start, endFrame: end + 9 } },
        parent,
      )
    : null;
  const nib = penExposure ? penNib(p, penExposure.id) : null;
  for (let f = start; f <= end; f += 2) {
    let remain = (total * (f - start)) / (end - start),
      tip = firstPoint,
      pts = [tip];
    for (const { from, to, length } of segments) {
      if (remain <= 0) break;
      if (length === 0) continue;
      const u = Math.min(1, remain / length);
      tip = [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u];
      pts.push(tip);
      remain -= length;
    }
    const cel = p.addGroup(`Ink exposure ${f}`, {}, track.id),
      l = p.addVectorLayer("Selected stroke", {}, cel.id);
    if (pts.length > 1) path(l, pts, color, width);
    keys.push({ frame: f, drawingId: cel.id });
    if (nib)
      b.production.addLayerKeyframe(nib.id, f, {
        transform: { x: tip[0], y: tip[1] },
        easing: "hold",
      });
  }
  b.production.setDrawingSequence(track.id, keys);
  if (nib) {
    b.production.addLayerKeyframe(nib.id, end + 2, { opacity: 1, easing: "linear" });
    b.production.addLayerKeyframe(nib.id, end + 8, { opacity: 0, easing: "hold" });
  }
  return track;
}
export const turnCelCount = 32;
function turnDrawing(p: PanelHandle, yaw: number, parent?: string) {
  const g = p.addGroup("Turnaround cel", {}, parent);
  const c = Math.cos(yaw),
    s = Math.sin(yaw),
    width = Math.hypot(206 * c, 142 * s);
  const h = 132,
    bottom = -39,
    top = bottom - h;
  const body = (u: number, v: number): Point => [(u * width) / 2, bottom + v * h];
  const legs = (
    [
      [-66, -33],
      [66, -33],
      [-66, 33],
      [66, 33],
    ] as const
  )
    .map(([x, z], id) => ({
      id,
      x: x * c + z * s,
      depth: -x * s + z * c,
    }))
    .sort((a, b) => b.depth - a.depth);
  for (const { id, x, depth } of legs) {
    const l = p.addVectorLayer(`Leg ${id + 1} / depth ordered`, {}, g.id);
    const fy = -7 - depth * 0.075,
      hx = x * 0.94,
      hy = bottom - 8,
      kx = x + (x < 0 ? -3 : 3);
    poly(
      l,
      [
        [hx - 12, hy],
        [hx + 13, hy],
        [kx + 12, -22],
        [x + 15, fy - 6],
        [x + 11, fy],
        [x - 13, fy],
        [x - 17, fy - 6],
        [kx - 12, -22],
      ],
      depth > 0 ? colors.far : colors.orange,
    );
  }
  const l = p.addVectorLayer("Selected turn contour", {}, g.id);
  const outline = (
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
  ).map(([u, v]) => body(u, v));
  poly(l, outline, colors.orange);
  // The turning silhouette stays broad and graphic; only a narrow overlap
  // edge describes depth, rather than a shaded cube with a separate lid.
  const edge = Math.abs(s) * 15,
    side = s >= 0 ? 1 : -1;
  if (edge > 1)
    poly(
      l,
      [
        [side * (width / 2 - 2), top + 12],
        [side * (width / 2 - edge), top + 15],
        [side * (width / 2 - edge + 2), bottom - 3],
        [side * (width / 2 - 9), bottom - 3],
      ],
      "#dc6b2c",
    );
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    assert.ok(a && b);
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      len = Math.hypot(dx, dy);
    if (len > 35)
      for (const u of [0.23, 0.62] as const) {
        const x = a[0] + u * dx,
          y = a[1] + u * dy;
        poly(
          l,
          [
            [x - (2 * dx) / len, y - (2 * dy) / len],
            [x + (3 * dx) / len, y + (3 * dy) / len],
            [x - (dy / len) * 1.3, y + (dx / len) * 1.3],
          ],
          colors.bg,
        );
      }
  }
  for (const [u, v] of [
    [-0.81, -0.78],
    [-0.66, -0.43],
    [-0.43, -0.88],
    [0.05, -0.89],
    [0.65, -0.15],
  ] as const)
    path(l, [body(u, v), body(u - 0.045, v + 0.1)], "#bb5627", 1.15);
  path(l, [body(-0.85, -0.93), body(-0.4, -0.945), body(0.55, -0.93)], "#ffc078", 1.5);
  // Eyes remain attached to the front face and disappear by overlap at profile.
  if (c > 0.015) {
    const center = -s * width * 0.41,
      separation = 28 * c,
      ew = Math.max(1.1, 4.5 * c);
    for (const ex of [center - separation, center + separation] as const) {
      if (Math.abs(ex) > width / 2 - 7) continue;
      const ey = top + 48;
      poly(
        l,
        [
          [ex - ew, ey + 2],
          [ex + ew - 1, ey],
          [ex + ew, ey + 23],
          [ex + ew - 2, ey + 26],
          [ex - ew, ey + 24],
        ],
        colors.black,
      );
    }
  }
  return g;
}
export function turnaround(b: StoryboardProject, p: PanelHandle, start: number, _end: number) {
  text(p, "Codeboard", 92, 100, 42);
  text(p, "One character. Every angle.", 92, 191, 56);
  label(p, "MODEL SHEET / 32 DRAWINGS / ON TWOS", 92, 264, 24, colors.orange);
  const stage = p.addGroup("Turntable staging", {
      transform: { x: 1240, y: 787, scaleX: 2.45, scaleY: 2.45 },
    }),
    track = p.addGroup("Turnaround sequence", {}, stage.id),
    keys = [];
  for (let i = 0; i < turnCelCount; i++) {
    const cel = turnDrawing(p, (i / turnCelCount) * Math.PI * 2, track.id);
    keys.push({ frame: i === 0 ? start : start + 12 + (i - 1) * 2, drawingId: cel.id });
  }
  const first = keys[0];
  assert.ok(first, "Turnaround needs a first drawing");
  keys.push({ frame: start + 74, drawingId: first.drawingId });
  b.production.setDrawingSequence(track.id, keys);
  const rules = [
    ["01", "Keep the silhouette."],
    ["02", "Track the four feet."],
    ["03", "Turn. Check. Draw."],
  ] as const;
  for (const [i, [n, s]] of rules.entries()) {
    label(p, n, 100, 436 + i * 82, 25, colors.orange);
    label(p, s, 160, 437 + i * 82, 29);
  }
  for (const [i, name] of ["FRONT", "RIGHT", "BACK", "LEFT"].entries()) {
    const g = p.addGroup(`View ${name}`, {
      transform: { x: 330 + i * 405, y: 1035, scaleX: 0.65, scaleY: 0.65 },
    });
    turnDrawing(p, (i / 4) * Math.PI * 2, g.id);
    label(p, name, 270 + i * 405, 896, 21, colors.muted);
  }
  const l = p.addVectorLayer("Turntable registration");
  path(
    l,
    [
      [925, 792],
      [1550, 792],
    ],
    colors.muted,
    1.5,
  );
  inkAction(
    b,
    p,
    [
      [103, 687],
      [309, 687],
      [380, 658],
    ],
    start + 12,
    start + 36,
    { pen: false },
  );
}
export function rigging(b: StoryboardProject, p: PanelHandle, start: number, _end: number) {
  text(p, "Codeboard", 92, 100, 42);
  text(p, "Give the drawing its controls.", 92, 190, 54);
  label(p, "POSE CONTROLS / DRAWING GENERATOR", 95, 260, 24, colors.orange);
  label(p, "Body", 100, 420, 33);
  label(p, "width / height / lean", 100, 465, 25, colors.muted);
  label(p, "Four legs", 100, 574, 33);
  label(p, "hip → knee → planted sole", 100, 619, 25, colors.muted);
  label(p, "Controls generate new contours.", 100, 852, 27);
  const track = p.addGroup("Rig controls and generated contours"),
    keys = [];
  const frames = [110, 114, 118, 122, 124, 128, 130, 128, 124, 118, 110, 110];
  for (const [i, f] of frames.entries()) {
    const e = at(f),
      pose = drawing(e.id),
      cel = p.addGroup(`Rig / ${e.id}`, {}, track.id);
    drawClawd(p, pose, { x: 1280, y: 820, scale: 2.3, parent: cel.id });
    const controls = p.addGroup(
        "Visible authoring controls",
        { transform: { x: 1280, y: 820, scaleX: 2.3, scaleY: 2.3 } },
        cel.id,
      ),
      l = p.addVectorLayer("Joint chains and body cage", {}, controls.id);
    for (let j = 0; j < 4; j++) {
      const { hipX: hx, hipY: hy, kneeX: kx, kneeY: ky, foot } = legJoints(pose, j);
      path(
        l,
        [
          [hx, hy],
          [kx, ky],
          [foot.x, foot.y],
        ],
        j < 2 ? "#ddb998" : colors.paper,
        1.2,
      );
      for (const [x, y] of [
        [hx, hy],
        [kx, ky],
        [foot.x, foot.y],
      ] as const)
        dot(l, x, y, 3, j < 2 ? "#ddb998" : colors.paper);
      if (foot.planted)
        path(
          l,
          [
            [foot.x - 20, 2],
            [foot.x + 20, 2],
          ],
          colors.orange,
          2,
        );
    }
    const top = pose.bottom - pose.h;
    path(
      l,
      [
        [-pose.w / 2 - 8, top - 8],
        [pose.w / 2 + pose.lean + 8, top - 8],
        [pose.w / 2 + 8, pose.bottom + 4],
        [-pose.w / 2 - 8, pose.bottom + 4],
        [-pose.w / 2 - 8, top - 8],
      ],
      "#ffc078",
      1,
    );
    for (const [x, y] of [
      [-pose.w / 2 - 8, top - 8],
      [pose.w / 2 + pose.lean + 8, top - 8],
      [0, pose.bottom],
    ] as const)
      dot(l, x, y, 4, "#ffc078");
    label(
      p,
      `w ${pose.w.toFixed(0)}   h ${pose.h.toFixed(0)}   lean ${pose.lean.toFixed(0)}`,
      1030,
      958,
      27,
      colors.orange,
      cel.id,
    );
    keys.push({ frame: start + i * 6, drawingId: cel.id });
  }
  const baked = p.addGroup("Controls hidden / resulting cel", {}, track.id);
  drawClawd(p, drawing(at(110).id), { x: 1280, y: 820, scale: 2.3, parent: baked.id });
  label(p, "DRAWING READY / CONTROLS HIDDEN", 960, 958, 26, colors.orange, baked.id);
  keys.push({ frame: start + 76, drawingId: baked.id });
  b.production.setDrawingSequence(track.id, keys);
  ground(p, 887, 1710, 826);
  inkAction(
    b,
    p,
    [
      [100, 693],
      [438, 693],
      [500, 671],
    ],
    start + 12,
    start + 30,
    { pen: false },
  );
}
