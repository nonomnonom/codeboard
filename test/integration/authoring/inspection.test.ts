import { afterEach, expect, it, vi } from "vitest";
afterEach(() => vi.restoreAllMocks());

import { StoryboardProject, brushes, createPixels } from "../../../src/index.js";

it("reads one drawing element without cloning siblings and owns its nested data", () => {
  const board = StoryboardProject.create({ title: "Element inspection" });
  const panel = board.addScene("S").addShot("A").addPanel();
  const group = panel.addGroup("Character"),
    ink = panel.addVectorLayer("Ink", {}, group.id);
  const stroke = ink.vectorStroke(
    [
      { x: 1, y: 2, pressure: 0.3 },
      { x: 10, y: 20, pressure: 0.9 },
    ],
    { name: "Contour" },
  );
  const paint = panel.addRasterLayer("Paint", {}, group.id),
    pixels = createPixels(4, 4);
  pixels.pixels.set([10, 20, 30, 255]);
  const surface = paint.rasterSurface(pixels);
  const component = board.production.captureComponent(group.id, "Source");
  const sourceLayer = board.production
    .find({ kind: "group" })
    .find((row) => row.parentId === component)!;
  const source = board.production.layer(sourceLayer.id);
  if (source.kind !== "group" || source.children[0]!.kind === "group")
    throw new Error("Expected source drawing");
  const sourceStroke = source.children[0]!.elements[0]!;
  const expected = board.toJSON(),
    version = board.version;
  const clone = vi.spyOn(globalThis, "structuredClone"),
    full = vi.spyOn(board, "toJSON").mockImplementation(() => {
      throw new Error("Full snapshot");
    });
  const layerRead = vi.spyOn(board.production, "layer").mockImplementation(() => {
    throw new Error("Whole layer");
  });
  try {
    const drawing = board.production.element(stroke);
    expect(clone).toHaveBeenCalledTimes(1);
    expect(clone.mock.calls[0]![0]).toMatchObject({ id: stroke, kind: "vector-stroke" });
    if (drawing.kind !== "vector-stroke") throw new Error("Expected stroke");
    drawing.points[0]!.x = 999;
    expect(board.production.element(stroke)).not.toEqual(drawing);
    const raster = board.production.element(surface);
    if (raster.kind !== "raster-surface") throw new Error("Expected pixels");
    raster.pixels.fill(0);
    raster.matrix[4] = 100;
    expect(board.production.element(surface)).not.toEqual(raster);
    expect(board.production.element(sourceStroke.id)).toEqual(sourceStroke);
    expect(() => board.production.element(group.id)).toThrow(
      `Drawing element not found: ${group.id}`,
    );
    expect(() => board.production.element("missing")).toThrow("Drawing element not found: missing");
    expect(board.version).toBe(version);
  } finally {
    clone.mockRestore();
    full.mockRestore();
    layerRead.mockRestore();
  }
  expect(board.toJSON()).toEqual(expected);
});

it("checks transition edits and lock ownership without full inspection snapshots", () => {
  const board = StoryboardProject.create({ title: "Production preflight" });
  const panel = board.addScene("S").addShot("A").addPanel();
  const lock = board.production.lock("panel", panel.id, "Approved drawing");
  const other = StoryboardProject.fromJSON(board.toJSON(), { actor: "other" });
  const foreignBefore = other.toJSON(),
    before = board.toJSON();
  const reads = [board, other].map((p) =>
    vi.spyOn(p, "toJSON").mockImplementation(() => {
      throw new Error("Unexpected full document clone");
    }),
  );
  try {
    expect(() => other.production.unlock(lock)).toThrow(/Only agent:local/);
    expect(() =>
      other.production.setTransition(panel.id, { type: "dissolve", durationFrames: 8 }),
    ).toThrow(/Locked/);
    expect(() => board.production.unlock("absent")).toThrow("Lock not found: absent");
    expect(() => board.production.unlock(lock, { expectedVersion: board.version - 1 })).toThrow(
      /Version conflict/,
    );
    board.production.unlock(lock);
    board.transaction("Correct a transition", () => {
      expect(() =>
        board.production.setTransition(panel.id, { type: "dissolve", durationFrames: 48 }),
      ).toThrow(/fit inside/);
      board.production.setTransition(panel.id, { type: "dissolve", durationFrames: 8 });
    });
    board.undo();
    board.undo();
  } finally {
    reads.forEach((read) => {
      read.mockRestore();
    });
  }
  expect(other.toJSON()).toEqual(foreignBefore);
  expect(board.toJSON().panels).toEqual(before.panels);
  expect(board.toJSON().locks).toEqual(before.locks);
});

it("reads only requested audit entries and brush resources with independent ownership", () => {
  const board = StoryboardProject.create({ title: "Targeted resource reads" });
  const panel = board.addScene("S").addShot("A").addPanel();
  panel.addVectorLayer("Ink").vectorStroke([
    { x: 1, y: 2 },
    { x: 3, y: 4 },
  ]);
  const baseline = board.version;
  const id = board.production.createBrush({
    ...brushes.cleanInk,
    id: "bitmap",
    tip: { ...brushes.cleanInk.tip, kind: "bitmap", width: 2, height: 2, alpha: [0, 0.3, 0.7, 1] },
  });
  const expected = board.toJSON(),
    version = board.version;
  const fullRead = vi.spyOn(board, "toJSON").mockImplementation(() => {
    throw new Error("Unexpected full document clone");
  });
  try {
    const changes = board.production.changesSince(baseline);
    expect(changes).toEqual(expected.changes.filter((change) => change.version > baseline));
    expect(changes.length).toBeGreaterThan(0);
    changes[0]!.targetIds.push("unowned");
    changes.length = 0;
    expect(board.production.changesSince(baseline)).toEqual(
      expected.changes.filter((change) => change.version > baseline),
    );
    expect(board.production.changesSince(version)).toEqual([]);
    const brush = board.production.brush(id);
    expect(brush).toEqual(expected.brushes.find((entry) => entry.id === id));
    if (brush.tip.kind !== "bitmap") throw new Error("Expected bitmap tip");
    brush.tip.alpha[1] = 1;
    brush.dynamics.pressureSize = 0;
    brush.name = "Unowned";
    expect(board.production.brush(id)).toEqual(expected.brushes.find((entry) => entry.id === id));
    expect(() => board.production.brush("absent")).toThrow("Brush not found: absent");
    expect(board.version).toBe(version);
  } finally {
    fullRead.mockRestore();
  }
  expect(board.toJSON()).toEqual(expected);
});

it("pages metadata without cloning artwork and isolates targeted layer reads", () => {
  const board = StoryboardProject.create({ title: "Inspection" });
  const shot = board.addScene("S").addShot("A"),
    panel = shot.addPanel({ id: "p" });
  const group = panel.addGroup("Character"),
    layer = panel.addVectorLayer("Ink", {}, group.id);
  board.transaction("Author workload", () => {
    for (let i = 0; i < 240; i++)
      layer.vectorStroke([{ x: i, y: 10 }], { id: `stroke:${i}`, name: `Detail ${i}` });
  });
  const other = shot.addPanel({ id: "other" });
  other.addVectorLayer("Other ink").vectorStroke([{ x: 1, y: 1 }], { name: "Detail elsewhere" });
  const component = board.production.captureComponent(group.id, "Reusable character");
  const version = board.version,
    fullRead = vi.spyOn(board, "toJSON").mockImplementation(() => {
      throw new Error("Unexpected full document clone");
    });
  try {
    const inspection = board.production.inspect();
    expect(inspection.durationFrames).toBe(96);
    expect(inspection.scenes[0]!.shots[0]!.panelIds).toEqual([panel.id, other.id]);
    inspection.scenes[0]!.shots[0]!.panelIds.length = 0;
    inspection.sequences[0]!.sceneIds.length = 0;
    expect(board.production.inspect().scenes[0]!.shots[0]!.panelIds).toEqual([panel.id, other.id]);
    expect(board.production.inspect().sequences[0]!.sceneIds).toHaveLength(1);
    const query = { panelId: panel.id, kind: "vector-stroke" };
    expect(board.production.find(query)).toHaveLength(50);
    expect(board.production.find({ ...query, limit: 999 })).toHaveLength(200);
    expect(board.production.find({ ...query, offset: 230, limit: 50 }).map((e) => e.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `stroke:${230 + i}`),
    );
    expect(board.production.find({ ...query, offset: 240 })).toEqual([]);
    const result = board.production.find({ ...query, name: "DETAIL 239" });
    expect(result).toEqual([
      {
        id: "stroke:239",
        name: "Detail 239",
        kind: "vector-stroke",
        parentId: layer.id,
        panelId: panel.id,
      },
    ]);
    result[0]!.name = "Changed externally";
    expect(board.production.find({ ...query, name: "Detail 239" })[0]!.name).toBe("Detail 239");
    const copy = board.production.layer(layer.id);
    copy.name = "Edited copy";
    expect(board.production.layer(layer.id).name).toBe("Ink");
    expect(board.production.find({ kind: "component" })[0]!.id).toBe(component);
    const source = board.production
      .find({ kind: "group", name: "Character" })
      .find((e) => e.parentId === component)!;
    expect(board.production.layer(source.id).name).toBe("Character");
    for (const invalid of [
      { limit: NaN },
      { limit: 0 },
      { offset: -1 },
      { limit: 1.5 },
      { offset: Infinity },
    ])
      expect(() => board.production.find(invalid)).toThrow(/integer/);
    expect(board.version).toBe(version);
  } finally {
    fullRead.mockRestore();
  }
});
