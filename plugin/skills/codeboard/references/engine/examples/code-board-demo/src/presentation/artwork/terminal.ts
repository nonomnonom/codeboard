import type { LayerHandle, PanelHandle } from "codeboard-studio";
import { poly, text } from "../../character/art.ts";
import type { Point } from "../../character/types.ts";
const line = (l: LayerHandle, pts: Point[], color: string, width: number) =>
  l.path(
    pts.map(([x, y], i) => ({ op: i ? ("L" as const) : ("M" as const), x, y })),
    { stroke: color, strokeWidth: width },
  );
const coral = "#d97757",
  muted = "#999994",
  paper = "#faf9f5";
const label = (
  p: PanelHandle,
  s: string,
  x: number,
  y: number,
  size: number,
  color = paper,
  parent?: string,
) => text(p, s, x, y, size, color, parent, "Consolas");
export function claudeMark(p: PanelHandle, x: number, y: number, scale = 1, parent?: string) {
  const g = p.addGroup(
    "Claude Code pixel mark",
    { transform: { x, y, scaleX: scale, scaleY: scale } },
    parent,
  );
  const l = p.addVectorLayer("Reference-matched terminal mascot", {}, g.id);
  poly(
    l,
    [
      [0, 0],
      [89, 0],
      [89, 33],
      [104, 33],
      [104, 66],
      [89, 66],
      [89, 81],
      [81, 81],
      [81, 66],
      [66, 66],
      [66, 81],
      [58, 81],
      [58, 66],
      [22, 66],
      [22, 81],
      [14, 81],
      [14, 66],
      [7, 66],
      [7, 81],
      [0, 81],
      [0, 66],
      [-16, 66],
      [-16, 33],
      [0, 33],
    ],
    coral,
  );
  for (const x of [14, 67] as const)
    poly(
      l,
      [
        [x, 16],
        [x + 8, 16],
        [x + 8, 32],
        [x, 32],
      ],
      "#201f1d",
    );
  return g;
}
function dashed(l: LayerHandle, x1: number, y1: number, x2: number, y2: number) {
  const n = Math.hypot(x2 - x1, y2 - y1);
  for (let d = 0; d < n; d += 12) {
    const e = Math.min(n, d + 5);
    line(
      l,
      [
        [x1 + ((x2 - x1) * d) / n, y1 + ((y2 - y1) * d) / n],
        [x1 + ((x2 - x1) * e) / n, y1 + ((y2 - y1) * e) / n],
      ],
      coral,
      1.8,
    );
  }
}
export function welcomeTerminal(p: PanelHandle) {
  const surface = p.addVectorLayer("Claude terminal surface");
  poly(
    surface,
    [
      [132, 398],
      [1788, 398],
      [1788, 858],
      [132, 858],
    ],
    "#201f1d",
  );
  const l = p.addVectorLayer("Terminal dashed border and prompt rule");
  dashed(l, 165, 433, 191, 433);
  dashed(l, 429, 433, 1752, 433);
  dashed(l, 165, 433, 165, 663);
  dashed(l, 1752, 433, 1752, 663);
  dashed(l, 165, 663, 1752, 663);
  dashed(l, 825, 449, 825, 648);
  label(p, "Claude Code", 207, 442, 29, coral);
  label(p, "Welcome to Codeboard", 253, 490, 28);
  claudeMark(p, 424, 517, 0.9);
  label(p, "~/codeboard", 369, 640, 24, muted);
  label(p, "Animation project", 858, 487, 27, coral);
  label(p, "Clawd / walk, notice, hop", 858, 535, 27);
  label(p, "Drawings + exposure + sound", 858, 579, 27);
  label(p, "1920 x 1080 / 24 fps", 858, 623, 24, muted);
  line(
    l,
    [
      [165, 688],
      [1752, 688],
    ],
    "#555550",
    1.4,
  );
  label(p, ">", 169, 737, 34);
  label(p, "? for shortcuts", 169, 838, 21, muted);
}
export function toolTerminal(p: PanelHandle) {
  const surface = p.addVectorLayer("Claude tool transcript surface");
  poly(
    surface,
    [
      [840, 266],
      [1828, 266],
      [1828, 896],
      [840, 896],
    ],
    "#201f1d",
  );
  const l = p.addVectorLayer("Tool transcript divider");
  claudeMark(p, 881, 282, 0.35);
  label(p, "Claude Code", 939, 312, 27, coral);
  line(
    l,
    [
      [868, 338],
      [1800, 338],
    ],
    "#555550",
    1,
  );
}
export function toolCall(
  p: PanelHandle,
  parent: string | undefined,
  title: string,
  file: string,
  y: number,
) {
  label(p, "●", 884, y, 23, coral, parent);
  label(p, title, 921, y, 27, paper, parent);
  label(p, file, 921, y + 38, 24, muted, parent);
  label(p, "└", 891, y + 38, 24, muted, parent);
}
