import { expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  splitPathSegment,
  pathCommands,
  StoryboardProject,
  renderPanelPNG,
  type PathCommand,
} from "../../../src/index.js";

function point(start: { x: number; y: number }, segment: PathCommand, t: number) {
  if (segment.op === "M" || segment.op === "Z") throw new Error("Expected curve");
  const u = 1 - t;
  if (segment.op === "L") return { x: u * start.x + t * segment.x, y: u * start.y + t * segment.y };
  if (segment.op === "Q")
    return {
      x: u * u * start.x + 2 * u * t * segment.x1 + t * t * segment.x,
      y: u * u * start.y + 2 * u * t * segment.y1 + t * t * segment.y,
    };
  if (segment.op === "C")
    return {
      x:
        u ** 3 * start.x +
        3 * u * u * t * segment.x1 +
        3 * u * t * t * segment.x2 +
        t ** 3 * segment.x,
      y:
        u ** 3 * start.y +
        3 * u * u * t * segment.y1 +
        3 * u * t * t * segment.y2 +
        t ** 3 * segment.y,
    };
  throw new Error("Unsupported segment");
}

it.each(["L 90 45", "Q 15 -30 90 45", "C 15 -30 65 100 90 45"])(
  "subdivides %s with the same curve and detached commands",
  (curve) => {
    const commands = pathCommands(`M 4 8 ${curve} L 100 70 Z`),
      before = structuredClone(commands),
      split = 0.37;
    const result = splitPathSegment(commands, 1, split),
      knot = result[1]!;
    if (knot.op === "Z") throw new Error("Knot");
    for (let i = 0; i <= 100; i++) {
      const t = i / 100,
        expected = point({ x: 4, y: 8 }, commands[1]!, t);
      const actual =
        t <= split
          ? point({ x: 4, y: 8 }, result[1]!, t / split)
          : point(knot, result[2]!, (t - split) / (1 - split));
      expect(actual.x).toBeCloseTo(expected.x, 10);
      expect(actual.y).toBeCloseTo(expected.y, 10);
    }
    expect(result.slice(3)).toEqual(commands.slice(2));
    (result[0] as { x: number }).x = 999;
    expect(commands).toEqual(before);
  },
);

it("uses the contour start after closing and rejects invalid split requests", () => {
  const commands = pathCommands("M 10 20 L 50 20 Z L 30 40 M 90 90 Q 100 70 120 90");
  expect(splitPathSegment(commands, 3)[3]).toEqual({ op: "L", x: 20, y: 30 });
  expect(splitPathSegment(commands, 5)[5]).toEqual({ op: "Q", x1: 95, y1: 80, x: 102.5, y: 80 });
  for (const index of [-1, 0.5, 0, 2, 99])
    expect(() => splitPathSegment(commands, index)).toThrow();
  for (const t of [0, 1, NaN, Infinity, -0.5])
    expect(() => splitPathSegment(commands, 1, t)).toThrow();
  expect(() => splitPathSegment([{ op: "L", x: 0, y: 0 }], 0)).toThrow(/begin/);
});

it("keeps an edited contour identity, undo and exact saved command coordinates", async () => {
  const directory = await mkdtemp(join(tmpdir(), "path-split-"));
  try {
    const p = StoryboardProject.create({
      title: "Local contour correction",
      width: 128,
      height: 80,
    });
    const panel = p.addScene("S").addShot("S").addPanel(),
      layer = panel.addVectorLayer("Ink");
    const id = layer.path(pathCommands("M 10 60 C 15 5 90 5 110 60"), {
      stroke: "black",
      strokeWidth: 3,
    });
    const before = p.toJSON(),
      original = await renderPanelPNG(p, panel.id);
    layer.edit(id, (e) => {
      if (e.kind !== "vector-path") throw new Error("Contour");
      const commands = splitPathSegment(e.commands, 1),
        second = commands[2]!;
      if (second.op !== "C") throw new Error("Cubic");
      second.y1 += 12;
      return { ...e, commands };
    });
    const after = p.toJSON(),
      image = await renderPanelPNG(p, panel.id);
    expect(image.equals(original)).toBe(false);
    p.undo();
    expect(p.toJSON().panels).toEqual(before.panels);
    p.redo();
    const file = join(directory, "drawing.cboard");
    await p.save(file);
    const reopened = await StoryboardProject.open(file);
    expect(reopened.toJSON().panels).toEqual(after.panels);
    expect(await renderPanelPNG(reopened, panel.id)).toEqual(image);
    expect(reopened.production.find({ kind: "vector-path" })[0]!.id).toBe(id);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
