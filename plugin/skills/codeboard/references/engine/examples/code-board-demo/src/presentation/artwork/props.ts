import type { PanelHandle, StoryboardProject } from "codeboard-studio";
import { colors, drawClawd, line, poly, text } from "../../character/art.ts";
import { at, drawing } from "../../character/poses.ts";
export function fileProp(
  p: PanelHandle,
  {
    x,
    y,
    name,
    parent,
    scale = 1,
    accent = colors.orange,
  }: {
    x: number;
    y: number;
    name: string;
    parent?: string;
    scale?: number;
    accent?: string;
  },
) {
  const g = p.addGroup(name, { transform: { x, y, scaleX: scale, scaleY: scale } }, parent),
    l = p.addVectorLayer("Folded project sheet", {}, g.id);
  poly(
    l,
    [
      [0, 0],
      [86, 0],
      [114, 28],
      [114, 144],
      [0, 144],
    ],
    colors.bg,
    colors.paper,
    2,
  );
  line(
    l,
    [
      [86, 0],
      [86, 28],
      [114, 28],
    ],
    colors.paper,
    2,
  );
  line(
    l,
    [
      [17, 51],
      [88, 51],
    ],
    accent,
    5,
  );
  line(
    l,
    [
      [17, 71],
      [75, 71],
    ],
    colors.muted,
    2,
  );
  line(
    l,
    [
      [17, 86],
      [89, 86],
    ],
    colors.muted,
    2,
  );
  text(p, name, 57, 121, 18, colors.paper, g.id, "Consolas", "center");
  return g;
}
export function celStack(
  b: StoryboardProject,
  p: PanelHandle,
  {
    x,
    y,
    start,
    parent,
  }: {
    x: number;
    y: number;
    start: number;
    end: number;
    parent?: string;
  },
) {
  const g = p.addGroup("Reusable drawing stack", { transform: { x, y } }, parent);
  const l = p.addVectorLayer("Three registered cel sheets", {}, g.id);
  for (const [dx, dy] of [
    [22, -22],
    [11, -11],
    [0, 0],
  ] as const) {
    poly(
      l,
      [
        [dx, dy],
        [dx + 300, dy],
        [dx + 300, dy + 182],
        [dx, dy + 182],
      ],
      colors.bg,
      colors.paper,
      1.6,
    );
    for (const px of [125, 150, 175] as const)
      poly(
        l,
        [
          [dx + px - 3, dy + 8],
          [dx + px + 3, dy + 8],
          [dx + px + 3, dy + 12],
          [dx + px - 3, dy + 12],
        ],
        colors.muted,
      );
  }
  const track = p.addGroup("Cel stack drawing alternatives", {}, g.id),
    keys = [];
  for (const [i, f] of [0, 4, 8].entries()) {
    const e = at(f),
      cel = p.addGroup(`Sheet ${e.id}`, {}, track.id);
    drawClawd(p, drawing(e.id), { parent: cel.id, x: 146, y: 155, scale: 0.66 });
    text(p, e.id, 267, 162, 19, colors.orange, cel.id, "Consolas", "right");
    keys.push({ frame: start + i * 32, drawingId: cel.id });
  }
  b.production.setDrawingSequence(track.id, keys);
  text(p, "DRAWINGS / EDITABLE", 150, 218, 21, colors.muted, g.id, "Consolas", "center");
  return g;
}
export function penNib(p: PanelHandle, parent?: string) {
  const g = p.addGroup("Procedural ink pen", {}, parent),
    l = p.addVectorLayer("Nib and barrel contours", {}, g.id);
  poly(
    l,
    [
      [0, 0],
      [8, -31],
      [36, -74],
      [48, -64],
      [20, -21],
    ],
    colors.bg,
    colors.paper,
    2,
  );
  line(
    l,
    [
      [8, -31],
      [20, -21],
    ],
    colors.orange,
    4,
  );
  line(
    l,
    [
      [0, 0],
      [14, -26],
    ],
    colors.paper,
    1.5,
  );
  poly(
    l,
    [
      [36, -74],
      [46, -88],
      [57, -79],
      [48, -64],
    ],
    colors.orange,
  );
  return g;
}
export function registration(p: PanelHandle, x1: number, x2: number, y: number, parent?: string) {
  const l = p.addVectorLayer("Animation-paper registration", {}, parent);
  for (const x of [(x1 + x2) / 2 - 32, (x1 + x2) / 2, (x1 + x2) / 2 + 32] as const)
    poly(
      l,
      [
        [x - 4, y - 2],
        [x + 4, y - 2],
        [x + 4, y + 2],
        [x - 4, y + 2],
      ],
      colors.muted,
    );
  line(
    l,
    [
      [x1, y + 28],
      [x1, y + 42],
      [x1 + 14, y + 42],
    ],
    colors.muted,
    1.5,
  );
  line(
    l,
    [
      [x2 - 14, y + 42],
      [x2, y + 42],
      [x2, y + 28],
    ],
    colors.muted,
    1.5,
  );
}
