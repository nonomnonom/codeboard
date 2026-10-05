import type { LayerHandle } from "codeboard-studio";
import { contour, stroke } from "./marks.ts";
import { ink, amber } from "./palette.ts";
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
