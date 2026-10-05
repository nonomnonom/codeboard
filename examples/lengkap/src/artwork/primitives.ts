import {
  catmullRom,
  type LayerHandle,
  type PanelHandle,
  type Point,
  type StoryboardProject,
} from "codeboard-studio";
import { ink, dry, fine, rough } from "./palette.ts";
export type XY = readonly [number, number];
export class Art {
  readonly root: LayerHandle;
  readonly board: StoryboardProject;
  readonly panel: PanelHandle;
  readonly start: number;
  constructor(board: StoryboardProject, panel: PanelHandle, start: number) {
    this.board = board;
    this.panel = panel;
    this.start = start;
    this.root = panel.addGroup("Artwork / 1280 × 720 design coordinates", {
      transform: { scaleX: 1.5, scaleY: 1.5 },
    });
  }
  layer(name: string, parent = this.root.id) {
    return this.panel.addRasterLayer(name, {}, parent);
  }
  text(
    name: string,
    value: string,
    x: number,
    y: number,
    font: string,
    parent = this.root.id,
    color = ink,
  ) {
    const l = this.panel.addVectorLayer(name, {}, parent);
    l.text(value, x, y, { font, color });
    return l;
  }
  group(name: string, x = 0, y = 0, s = 1, parent = this.root.id) {
    return this.panel.addGroup(name, { transform: { x, y, scaleX: s, scaleY: s } }, parent);
  }
  stroke(
    l: LayerHandle,
    xy: readonly XY[],
    size: number,
    at?: number,
    duration = 6,
    color = ink,
    br = dry,
  ) {
    const phase = xy[0]![0] * 0.13 + xy[0]![1] * 0.07;
    const center = catmullRom(
      xy.map(([x, y]) => ({ x, y })),
      24,
    );
    const points = center.map((p, i) => {
      const t = i / (center.length - 1),
        prev = center[Math.max(0, i - 1)]!,
        next = center[Math.min(center.length - 1, i + 1)]!;
      const angle = Math.atan2(next.y - prev.y, next.x - prev.x);
      const wobble =
        Math.sin(Math.PI * t) *
        (Math.sin(t * 19 + phase) * 0.6 + Math.sin(t * 47 + phase) * 0.22) *
        Math.min(2.5, size * 0.045);
      return {
        ...p,
        x: p.x - Math.sin(angle) * wobble,
        y: p.y + Math.cos(angle) * wobble,
        pressure: 0.77 + 0.13 * Math.sin(t * 7 + phase) + 0.055 * Math.sin(t * 23 + phase),
        time: i * 8,
      };
    });
    const brush = br === dry && size < 20 ? fine : br;
    const result = this.points(l, points, size, at, duration, color, brush);
    if (br === dry && size >= 23) {
      // Broken edge passes share the primary stroke's reveal interval and stay fixed afterward.
      for (const [j, side] of [-0.42, 0.39, -0.3].entries()) {
        const start = [0.1, 0.31, 0.59][j]!,
          end = [0.46, 0.91, 0.97][j]!;
        const strand = points
          .map((p, i) => {
            const prev = points[Math.max(0, i - 1)]!,
              next = points[Math.min(points.length - 1, i + 1)]!,
              angle = Math.atan2(next.y - prev.y, next.x - prev.x);
            const offset =
              size * side * (p.pressure ?? 1) + Math.sin(i * 0.37 + phase) * size * 0.017;
            return {
              ...p,
              x: p.x - Math.sin(angle) * offset,
              y: p.y + Math.cos(angle) * offset,
              pressure: 0.4 + 0.4 * Math.sin((Math.PI * i) / (points.length - 1)),
            };
          })
          .slice(Math.floor(start * points.length), Math.ceil(end * points.length));
        const begin = at === undefined ? undefined : at + Math.floor(duration * start);
        this.points(
          l,
          strand,
          Math.max(0.9, size * 0.022),
          begin,
          Math.max(1, Math.ceil(duration * (end - start))),
          color,
          fine,
        );
      }
    }
    return result;
  }
  points(
    l: LayerHandle,
    points: Point[],
    size: number,
    at?: number,
    duration = 6,
    color = ink,
    br = rough,
  ) {
    return l.rasterStroke(
      points,
      { ...br, size },
      {
        color,
        seed: 37,
        ...(at === undefined
          ? {}
          : { reveal: { startFrame: this.start + at, endFrame: this.start + at + duration } }),
      },
    );
  }
  corners(
    l: LayerHandle,
    xy: readonly XY[],
    size: number,
    at?: number,
    duration = 6,
    color = ink,
    br = rough,
  ) {
    return this.points(
      l,
      xy.map(([x, y], i) => ({ x, y, pressure: 1, time: i * 80 })),
      size,
      at,
      duration,
      color,
      br,
    );
  }
  appear(l: LayerHandle, at: number, end = 60) {
    this.board.production.setExposure(l.id, {
      startFrame: this.start + at,
      endFrame: this.start + end,
    });
  }
  move(l: LayerHandle, keys: readonly (readonly [number, number, number, number?])[]) {
    for (const [at, x, y, rotation] of keys)
      this.board.production.addLayerKeyframe(l.id, this.start + at, {
        transform: { x, y, rotation: rotation ?? 0 },
        easing: "ease-in-out",
      });
  }
}
