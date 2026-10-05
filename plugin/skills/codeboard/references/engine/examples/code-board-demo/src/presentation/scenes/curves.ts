import { colors, ground, line, obstacle, poly } from "../../character/art.ts";
import { at } from "../../character/poses.ts";
import { group, header, mono, still, workspace } from "../artwork/layout.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: b, panel: p, start, ordinal }: SceneContext): void {
  header(p, ordinal + 1, "Draw through the change.");
  workspace(p, "Edit / Bezier trajectory");
  mono(p, "x(u) = 846 + 390u", 120, 398, 29, colors.paper);
  mono(p, "y(u) = -185 x 4u(1-u)", 120, 445, 29, colors.orange);
  mono(p, "Same parabola, cubic Bezier form.", 120, 502, 25, colors.muted);
  const x0 = 151,
    x3 = 742,
    y0 = 806,
    height = 178,
    x1 = x0 + (x3 - x0) / 3,
    x2 = x0 + (2 * (x3 - x0)) / 3,
    cy = y0 - (height * 4) / 3;
  const curve = p.addVectorLayer("Exact cubic representation of hop");
  line(
    curve,
    [
      [x0, y0],
      [x1, cy],
    ],
    colors.muted,
    1.6,
  );
  line(
    curve,
    [
      [x3, y0],
      [x2, cy],
    ],
    colors.muted,
    1.6,
  );
  line(
    curve,
    [
      [x0, y0],
      [x3, y0],
    ],
    colors.muted,
    1,
  );
  curve.path(
    [
      { op: "M", x: x0, y: y0 },
      { op: "C", x1, y1: cy, x2, y2: cy, x: x3, y: y0 },
    ],
    { stroke: colors.orange, strokeWidth: 3.5 },
  );
  for (const [i, x, y] of [
    [0, x0, y0],
    [1, x1, cy],
    [2, x2, cy],
    [3, x3, y0],
  ] as const) {
    poly(
      curve,
      [
        [x - 5, y - 5],
        [x + 5, y - 5],
        [x + 5, y + 5],
        [x - 5, y + 5],
      ],
      colors.paper,
    );
    mono(p, `P${i}`, x, y + (i === 1 || i === 2 ? -20 : 35), 21, colors.paper, undefined, "center");
  }
  ground(p, 920, 1755, 788);
  obstacle(p, 1402, 788);
  const track = p.addGroup("Onion-skin trajectory review"),
    keys = [];
  for (let i = 0; i < 9; i++) {
    const f = 130 + i * 2,
      g = p.addGroup(`Review f${f}`, {}, track.id);
    for (const [neighbor, opacity] of [
      [f - 2, 0.16],
      [Math.min(154, f + 2), 0.16],
      [f, 1],
    ] as const) {
      const e = at(neighbor);
      still(p, neighbor, 1200 + (e.x - 846) * 0.9, 788, 0.9, g.id, opacity);
    }
    keys.push({ frame: start + i * 8, drawingId: g.id });
    const marker = group(p, `Curve position f${f}`, start + i * 8, start + (i + 1) * 8),
      u = (f - 130) / 22,
      x = x0 + (x3 - x0) * u,
      y = y0 - 4 * height * u * (1 - u);
    const dot = p.addVectorLayer("Selected curve point", {}, marker.id);
    poly(
      dot,
      [
        [x - 6, y - 6],
        [x + 6, y - 6],
        [x + 6, y + 6],
        [x - 6, y + 6],
      ],
      colors.orange,
    );
    mono(p, `f${f} / ${at(f).id}`, 1335, 851, 27, colors.paper, marker.id, "center");
  }
  b.production.setDrawingSequence(track.id, keys);
  mono(
    p,
    "Onion skin / previous + active + next",
    1335,
    964,
    25,
    colors.muted,
    undefined,
    "center",
  );
}
