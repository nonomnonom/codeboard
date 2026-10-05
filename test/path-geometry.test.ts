import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  combinePaths,
  pathBounds,
  pathContains,
  pathCommands,
  StoryboardProject,
  renderPanelPNG,
  decodePixels,
  ProjectStore,
} from "../src/index.js";

const rect = (x: number, y: number, w: number, h: number) =>
  pathCommands(`M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`);

it("combines regions, retains holes under nonzero fill and represents complete erasure", () => {
  const a = rect(0, 0, 10, 10),
    b = rect(5, 0, 10, 10),
    original = structuredClone(a);
  expect(pathBounds(combinePaths(a, b, "union"))).toMatchObject({ left: 0, right: 15, width: 15 });
  expect(pathBounds(combinePaths(a, b, "intersect"))).toMatchObject({
    left: 5,
    right: 10,
    width: 5,
  });
  const xor = combinePaths(a, b, "xor");
  expect(pathContains(xor, 2, 5)).toBe(true);
  expect(pathContains(xor, 7, 5)).toBe(false);
  expect(pathContains(xor, 12, 5)).toBe(true);
  const hole = combinePaths(a, rect(2, 2, 6, 6), "difference");
  expect(hole.filter((c) => c.op === "M")).toHaveLength(2);
  expect(pathContains(hole, 1, 5)).toBe(true);
  expect(pathContains(hole, 5, 5)).toBe(false);
  expect(combinePaths(a, a, "difference")).toEqual([]);
  expect(pathBounds([])).toBeNull();
  expect(pathContains([], 5, 5)).toBe(false);
  expect(a).toEqual(original);
});

it("keeps curved contours editable and rejects open or invalid cutters", () => {
  const curve = pathCommands("M 0 0 C 0 20 20 20 20 0 Z");
  const cut = combinePaths(curve, rect(10, -1, 20, 30), "difference");
  expect(cut.some((c) => c.op === "C")).toBe(true);
  expect(pathContains(cut, 5, 5)).toBe(true);
  expect(pathContains(cut, 15, 5)).toBe(false);
  expect(() => combinePaths(curve, pathCommands("M 1 1 L 5 5"), "difference")).toThrow(/closed/);
  expect(() => combinePaths(curve, [{ op: "M", x: Infinity, y: 0 }, { op: "Z" }], "union")).toThrow(
    /finite/,
  );
});

it("edits one stable contour through undo, binary persistence and empty-path rendering", async () => {
  const directory = await mkdtemp(join(tmpdir(), "board-boolean-"));
  try {
    const p = StoryboardProject.create({
      title: "Boolean",
      width: 64,
      height: 64,
      background: "#ffffff",
    });
    const shot = p.addScene("s").addShot("s"),
      panel = shot.addPanel({ id: "p" }),
      other = shot.addPanel({ id: "other" });
    const layer = panel.addVectorLayer("Ink"),
      id = layer.path(rect(4, 4, 56, 56), { fill: "#000000", name: "editable" });
    other.addVectorLayer("Other").path(rect(0, 0, 64, 64), { fill: "#345678" });
    const original = await renderPanelPNG(p, "p"),
      unaffected = await renderPanelPNG(p, "other");
    layer.booleanPath(id, rect(24, 24, 16, 16), "difference");
    const cut = await renderPanelPNG(p, "p"),
      pixels = await decodePixels(cut);
    expect([...pixels.pixels.slice((32 * 64 + 32) * 4, (32 * 64 + 32) * 4 + 4)]).toEqual([
      255, 255, 255, 255,
    ]);
    expect(pixels.pixels[(8 * 64 + 8) * 4]).toBe(0);
    expect(await renderPanelPNG(p, "other")).toEqual(unaffected);
    p.undo();
    expect(await renderPanelPNG(p, "p")).toEqual(original);
    p.redo();
    const file = join(directory, "boolean.cboard");
    await p.save(file);
    const reopened = await StoryboardProject.open(file);
    expect(await renderPanelPNG(reopened, "p")).toEqual(cut);
    const store = ProjectStore.open(file);
    try {
      store.verify();
      expect(store.findObjects({ name: "editable" })[0]!.id).toBe(id);
    } finally {
      store.close();
    }
    const version = p.version;
    expect(() => layer.booleanPath(id, pathCommands("M 1 1 L 2 2"), "difference")).toThrow(
      /closed/,
    );
    expect(p.version).toBe(version);
    layer.booleanPath(id, rect(0, 0, 64, 64), "difference");
    await p.save(file);
    const empty = await StoryboardProject.open(file),
      image = await decodePixels(await renderPanelPNG(empty, "p"));
    expect(image.pixels.every((v) => v === 255)).toBe(true);
    const finalLayer = empty.production.layer(layer.id);
    if (finalLayer.kind === "group") throw Error("Expected drawing");
    expect(finalLayer.elements[0]).toMatchObject({ id, commands: [] });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
