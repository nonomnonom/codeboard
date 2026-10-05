import type { PanelHandle } from "codeboard-studio";
import type { StoryboardProject } from "codeboard-studio";
import { colors, drawClawd, line, poly, text } from "../../character/art.ts";
import { at, drawing } from "../../character/poses.ts";
export const prompt = "Animate Clawd walking, stopping,\nand hopping over a line.";
export const mono = (
  p: PanelHandle,
  s: string,
  x: number,
  y: number,
  size = 28,
  color = colors.paper,
  parent?: string,
  align: "left" | "center" | "right" = "left",
) => text(p, s, x, y, size, color, parent, "Consolas", align);
export function box(
  p: PanelHandle,
  x: number,
  y: number,
  w: number,
  h: number,
  parent?: string,
  fill?: string,
) {
  const l = p.addVectorLayer("Window contour", {}, parent);
  poly(
    l,
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    fill,
    colors.muted,
    1.4,
  );
  return l;
}
export function group(p: PanelHandle, name: string, start: number, end: number) {
  return p.addGroup(name, { exposure: { startFrame: start, endFrame: end } });
}
export function enter(
  b: StoryboardProject,
  p: PanelHandle,
  name: string,
  start: number,
  end: number,
  { dy = 18 } = {},
) {
  const g = group(p, name, start, end);
  b.production.addLayerKeyframe(g.id, start, {
    opacity: 0,
    transform: { y: dy },
    easing: "ease-in-out",
  });
  b.production.addLayerKeyframe(g.id, start + 8, {
    opacity: 1,
    transform: { y: 0 },
    easing: "hold",
  });
  return g;
}
export function popup(
  b: StoryboardProject,
  p: PanelHandle,
  title: string,
  detail: string,
  start: number,
  end: number,
  x = 1230,
  y = 190,
  w = 570,
) {
  const g = enter(b, p, title, start, end);
  box(p, x, y, w, 114, g.id, colors.bg);
  const l = p.addVectorLayer("Tool accent", {}, g.id);
  line(
    l,
    [
      [x, y + 2],
      [x, y + 112],
    ],
    colors.orange,
    5,
  );
  mono(p, title, x + 24, y + 42, 28, colors.orange, g.id);
  mono(p, detail, x + 24, y + 82, 23, colors.paper, g.id);
  return g;
}
export function header(p: PanelHandle, index: number, title: string) {
  text(p, "Codeboard", 92, 100, 42);
  mono(p, "Claude Code / agent workflow demo", 1828, 90, 23, colors.muted, undefined, "right");
  text(p, title, 92, 188, 45);
  mono(p, String(index).padStart(2, "0"), 1828, 180, 28, colors.orange, undefined, "right");
}
export function workspace(p: PanelHandle, file: string) {
  box(p, 92, 266, 708, 630);
  box(p, 840, 266, 988, 630);
  mono(p, file, 116, 314, 25, colors.orange);
  mono(p, "Codeboard / canvas", 868, 314, 25);
  const l = p.addVectorLayer("Window dividers");
  line(
    l,
    [
      [92, 338],
      [800, 338],
    ],
    colors.muted,
    1,
  );
  line(
    l,
    [
      [840, 338],
      [1828, 338],
    ],
    colors.muted,
    1,
  );
}
export function type(
  _b: StoryboardProject,
  p: PanelHandle,
  value: string,
  x: number,
  y: number,
  start: number,
  end: number,
  size = 38,
) {
  let row = 0,
    col = 0,
    index = 0;
  for (const char of value) {
    if (char === "\n") {
      row++;
      col = 0;
      continue;
    }
    const frame = start + Math.floor(index * 0.9),
      g = group(p, `Typed character ${index}`, frame, end);
    mono(p, char, x + col * size * 0.6, y + row * size * 1.55, size, colors.paper, g.id);
    const next = start + Math.floor((index + 1) * 0.9),
      cursor = group(p, "Typing caret", frame, Math.max(frame + 1, next));
    const l = p.addVectorLayer("Caret", {}, cursor.id);
    poly(
      l,
      [
        [x + (col + 1) * size * 0.6, y + row * size * 1.55 - size * 0.8],
        [x + (col + 1) * size * 0.6 + 3, y + row * size * 1.55 - size * 0.8],
        [x + (col + 1) * size * 0.6 + 3, y + row * size * 1.55 + 6],
        [x + (col + 1) * size * 0.6, y + row * size * 1.55 + 6],
      ],
      colors.orange,
    );
    col++;
    index++;
  }
}
export function code(
  p: PanelHandle,
  lines: string[],
  start: number,
  end: number,
  {
    x = 118,
    y = 393,
    size = 29,
    step = 7,
  }: {
    x?: number;
    y?: number;
    size?: number;
    step?: number;
    parent?: string;
  } = {},
) {
  lines.forEach((s, i) => {
    const g = group(p, `Source line ${i + 1}`, start + i * step, end);
    mono(
      p,
      s,
      x,
      y + i * 43,
      size,
      /^(const |export |for\(|return |\}|\];)/.test(s.trim()) ? colors.orange : colors.paper,
      g.id,
    );
  });
}
export function still(
  p: PanelHandle,
  f: number,
  x: number,
  y: number,
  s = 1,
  parent?: string,
  opacity = 1,
  rough = false,
) {
  const e = at(f);
  return drawClawd(p, drawing(e.id), {
    x,
    y: y + e.y * s,
    scale: s,
    ...(parent === undefined ? {} : { parent }),
    opacity,
    rough,
    name: `${e.id} / action f${f}`,
  });
}
export function focusCel(
  b: StoryboardProject,
  p: PanelHandle,
  sourceFrames: number[],
  start: number,
  hold: number,
  { x = 1350, y = 784, scale = 1.65, rough = false } = {},
) {
  const track = p.addGroup("Drawing close-up");
  const ids = new Map<string, string>();
  for (const f of sourceFrames) {
    const e = at(f);
    if (!ids.has(e.id)) ids.set(e.id, still(p, f, x, y, scale, track.id, 1, rough).id);
  }
  b.production.setDrawingSequence(
    track.id,
    sourceFrames.map((f, i) => ({ frame: start + i * hold, drawingId: ids.get(at(f).id)! })),
  );
  return track;
}
export function sourceExcerpt(source: string, begin: string, end: string) {
  const a = source.indexOf(begin),
    b = source.indexOf(end, a);
  if (a < 0 || b < a) throw new Error(`Source excerpt missing: ${begin}`);
  return source.slice(a, b).trim();
}
export function wrapCode(s: string, width = 39) {
  const out = [];
  for (const line of s.split("\n")) {
    let rest = line.trim();
    while (rest.length > width) {
      let n = rest.lastIndexOf(",", width);
      if (n < 8) n = rest.lastIndexOf(" ", width);
      if (n < 8) n = width;
      else n++;
      out.push(rest.slice(0, n));
      rest = `  ${rest.slice(n).trimStart()}`;
    }
    out.push(rest);
  }
  return out;
}
