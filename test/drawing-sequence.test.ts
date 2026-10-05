afterEach(() => jest.restoreAllMocks());

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  StoryboardProject,
  ProjectStore,
  pathCommands,
  renderPanelPNG,
  decodePixels,
  renderOnionSkin,
  evaluateDrawing,
  createRenderSession,
} from "../src/index.js";

function setup() {
  const p = StoryboardProject.create({
    title: "Reusable drawings",
    width: 80,
    height: 60,
    background: "transparent",
  });
  const shot = p.addScene("S").addShot("S"),
    panel = shot.addPanel({ durationFrames: 12 }),
    later = shot.addPanel({ durationFrames: 4 });
  const track = panel.addGroup("Character", { transform: { x: 5 } }),
    a = panel.addVectorLayer("A", {}, track.id),
    b = panel.addGroup("B", {}, track.id);
  a.path(pathCommands("M 5 20 L 15 20 L 15 40 L 5 40 Z"), { fill: "red" });
  panel
    .addVectorLayer("B ink", {}, b.id)
    .path(pathCommands("M 25 20 L 35 20 L 35 40 L 25 40 Z"), { fill: "blue" });
  p.production.setDrawingSequence(track.id, [
    { frame: 2, drawingId: a.id },
    { frame: 4, drawingId: b.id },
    { frame: 6, drawingId: a.id },
    { frame: 8, drawingId: null },
  ]);
  return { p, shot, panel, later, track, a, b };
}

it("inspects adjacent held exposures without artwork snapshots, merging redundant keys and optionally skipping blanks", async () => {
  const { p, panel, track, a, b } = setup();
  p.production.setDrawingSequence(track.id, [
    { frame: 1, drawingId: a.id },
    { frame: 2, drawingId: a.id },
    { frame: 4, drawingId: null },
    { frame: 6, drawingId: b.id },
    { frame: 9, drawingId: a.id },
    { frame: 12, drawingId: null },
  ]);
  const before = p.toJSON(),
    spy = jest.spyOn(p, "toJSON").mockImplementation(() => {
      throw new Error("Full snapshot");
    });
  const adjacent = p.production.drawingNeighbors(track.id, 3);
  expect(adjacent).toEqual({
    current: { startFrame: 1, endFrame: 4, drawingId: a.id },
    previous: null,
    next: { startFrame: 6, endFrame: 9, drawingId: b.id },
  });
  expect(p.production.drawingNeighbors(track.id, 3, { skipBlank: false }).next).toEqual({
    startFrame: 4,
    endFrame: 6,
    drawingId: null,
  });
  expect(p.production.drawingNeighbors(track.id, 5)).toEqual({
    current: { startFrame: 4, endFrame: 6, drawingId: null },
    previous: { startFrame: 1, endFrame: 4, drawingId: a.id },
    next: { startFrame: 6, endFrame: 9, drawingId: b.id },
  });
  expect(p.production.drawingNeighbors(track.id, 11).current.endFrame).toBe(12);
  expect(p.production.drawingNeighbors(track.id, 11).next).toBeNull();
  expect(() => p.production.drawingNeighbors(track.id, 12)).toThrow(/outside/);
  expect(() => p.production.drawingNeighbors(track.id, 1.5)).toThrow(/integer/);
  adjacent.current.startFrame = 99;
  expect(p.production.drawingNeighbors(track.id, 3).current.startFrame).toBe(1);
  spy.mockRestore();
  expect(p.toJSON()).toEqual(before);
  const neighbors = p.production.drawingNeighbors(track.id, 5);
  const samples = [neighbors.previous!, neighbors.next!].map((interval, i) => ({
    panelId: panel.id,
    frame: interval.startFrame,
    layerIds: [track.id],
    tint: i ? "blue" : "red",
    opacity: 1,
  }));
  const image = await decodePixels(await renderOnionSkin(p, samples));
  expect([...image.pixels.slice((30 * 80 + 15) * 4, (30 * 80 + 15) * 4 + 4)]).toEqual([
    255, 0, 0, 255,
  ]);
  expect([...image.pixels.slice((30 * 80 + 35) * 4, (30 * 80 + 35) * 4 + 4)]).toEqual([
    0, 0, 255, 255,
  ]);
  p.production.setDrawingSequence(track.id, []);
  expect(p.production.drawingNeighbors(track.id, 4)).toEqual({
    current: { startFrame: 0, endFrame: 12, drawingId: null },
    previous: null,
    next: null,
  });
});

it("replaces a half-open exposure range without copying drawings or changing surrounding frames", async () => {
  const { p, panel, track, a, b } = setup(),
    before = p.toJSON();
  const frames = await Promise.all(
    Array.from({ length: 12 }, (_, frame) =>
      renderPanelPNG(p, panel.id, { frame, annotations: false }),
    ),
  );
  p.production.setDrawingRange(track.id, 3, 7, b.id);
  expect(p.production.drawingSequence(track.id).keys).toEqual([
    { frame: 2, drawingId: a.id },
    { frame: 3, drawingId: b.id },
    { frame: 7, drawingId: a.id },
    { frame: 8, drawingId: null },
  ]);
  const edited = p.toJSON().panels[0]!.layers[0]!;
  expect(edited.kind).toBe("group");
  if (edited.kind !== "group") throw new Error("fixture");
  expect(edited.children).toEqual((before.panels[0]!.layers[0] as typeof edited).children);
  for (let frame = 0; frame < 12; frame++)
    expect(await renderPanelPNG(p, panel.id, { frame, annotations: false })).toEqual(
      frames[frame >= 3 && frame < 7 ? 4 : frame],
    );
  const accepted = p.toJSON();
  p.production.setDrawingRange(track.id, 3, 7, b.id);
  expect(p.production.drawingSequence(track.id).keys).toEqual(
    (accepted.panels[0]!.layers[0] as typeof edited).drawingSequence,
  );
  p.undo();
  p.undo();
  expect(p.toJSON().panels).toEqual(before.panels);
  p.redo();
  const directory = await mkdtemp(join(tmpdir(), "drawing-range-"));
  try {
    const file = join(directory, "range.cboard");
    await p.save(file);
    const reopened = await StoryboardProject.open(file);
    for (const frame of [2, 3, 6, 7, 8])
      expect(await renderPanelPNG(reopened, panel.id, { frame })).toEqual(
        await renderPanelPNG(p, panel.id, { frame }),
      );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  p.production.setDrawingRange(track.id, 0, 2, b.id);
  expect(evaluateDrawing(p.production.drawingSequence(track.id).keys!, 2)).toBe(a.id);
  p.production.setDrawingRange(track.id, 4, 6, null);
  expect(
    [3, 4, 5, 6].map((frame) =>
      evaluateDrawing(p.production.drawingSequence(track.id).keys!, frame),
    ),
  ).toEqual([b.id, null, null, b.id]);
  p.production.setDrawingRange(track.id, 9, 11, a.id);
  expect(evaluateDrawing(p.production.drawingSequence(track.id).keys!, 11)).toBeNull();
});

it("preflights drawing references and ranges inside recoverable transactions", () => {
  const { p, track, a } = setup();
  p.transaction("Recover then revise", () => {
    for (const action of [
      () => p.production.setDrawingRange(track.id, 3, 7, "missing"),
      () => p.production.setDrawingRange(track.id, 3, 3, a.id),
      () => p.production.setDrawingRange(track.id, 1.5, 3, a.id),
      () => p.production.setDrawingRange(a.id, 1, 3, a.id),
      () => p.production.setDrawingSequence(track.id, [{ frame: 0, drawingId: "missing" }]),
    ]) {
      const before = p.toJSON();
      expect(action).toThrow();
      expect(p.toJSON()).toEqual(before);
    }
    p.production.setDrawingRange(track.id, 0, 1, a.id);
  });
  expect(evaluateDrawing(p.production.drawingSequence(track.id).keys!, 0)).toBe(a.id);
  expect(evaluateDrawing(p.production.drawingSequence(track.id).keys!, 1)).toBeNull();
});

it("holds and reuses editable drawings without copies, including blanks and selected onion skins", async () => {
  const { p, panel, track, a, b } = setup();
  const session = createRenderSession(p),
    before = await renderPanelPNG(p, panel.id, { frame: 2, annotations: false });
  const keys = p.production.drawingSequence(track.id).keys!;
  expect([0, 2, 3, 4, 6, 9].map((f) => evaluateDrawing(keys, f))).toEqual([
    null,
    a.id,
    a.id,
    b.id,
    a.id,
    null,
  ]);
  expect((await renderPanelPNG(p, panel.id, { frame: 6, annotations: false })).equals(before)).toBe(
    true,
  );
  for (const frame of [0, 2, 3, 4, 6, 8]) {
    const png = await renderPanelPNG(p, panel.id, { frame, annotations: false });
    expect((await session.frame(frame).toBuffer("png")).equals(png)).toBe(true);
    const pixels = await decodePixels(png),
      alpha = (x: number) => pixels.pixels[(30 * 80 + x) * 4 + 3];
    expect([alpha(15), alpha(35)]).toEqual(
      frame === 2 || frame === 3 || frame === 6 ? [255, 0] : frame === 4 ? [0, 255] : [0, 0],
    );
  }
  const ghost = await decodePixels(
    await renderOnionSkin(p, [
      { panelId: panel.id, frame: 2, layerIds: [track.id], tint: "red" },
      { panelId: panel.id, frame: 4, layerIds: [track.id], tint: "blue", opacity: 0.5 },
    ]),
  );
  expect(ghost.pixels[(30 * 80 + 15) * 4 + 3]).toBe(255);
  expect(ghost.pixels[(30 * 80 + 35) * 4 + 3]).toBe(128);
  a.path(pathCommands("M 16 20 L 21 20 L 21 40 L 16 40 Z"), { fill: "red" });
  expect(
    (await renderPanelPNG(p, panel.id, { frame: 2 })).equals(
      await renderPanelPNG(p, panel.id, { frame: 6 }),
    ),
  ).toBe(true);
  expect(p.production.drawingSequence(track.id).drawings).toHaveLength(2);
  const variant = p.production.duplicateDrawing(track.id, a.id, "A corrected only at frame six");
  const newKeys = p.production.drawingSequence(track.id).keys!;
  newKeys.find((k) => k.frame === 6)!.drawingId = variant;
  p.production.setDrawingSequence(track.id, newKeys);
  const variantLayer = p.production.layer(variant);
  expect(variantLayer.kind).toBe("vector");
  if (variantLayer.kind === "group") throw new Error("vector");
  p.select({
    panelId: panel.id,
    layerId: variant,
    elementIds: variantLayer.elements.map((e) => e.id),
  }).transform({ x: 10 });
  expect(
    (await renderPanelPNG(p, panel.id, { frame: 2 })).equals(
      await renderPanelPNG(p, panel.id, { frame: 6 }),
    ),
  ).toBe(false);
  expect(p.production.drawingSequence(track.id).keys![0]!.drawingId).toBe(a.id);
  const spy = jest.spyOn(p, "toJSON").mockImplementation(() => {
    throw new Error("Full snapshot");
  });
  const read = p.production.drawingSequence(track.id);
  read.keys![0]!.frame = 999;
  expect(p.production.drawingSequence(track.id).keys![0]!.frame).toBe(2);
  spy.mockRestore();
});

it("does not expose a mask belonging to an inactive alternative", async () => {
  const { p, panel, track, a } = setup();
  const consumer = panel.addVectorLayer("Masked outside track", { maskLayerId: a.id });
  consumer.path(pathCommands("M 0 0 L 80 0 L 80 60 L 0 60 Z"), { fill: "green" });
  const active = await decodePixels(
    await renderOnionSkin(p, [{ panelId: panel.id, frame: 2, layerIds: [consumer.id] }]),
  );
  const inactive = await decodePixels(
    await renderOnionSkin(p, [{ panelId: panel.id, frame: 4, layerIds: [consumer.id] }]),
  );
  expect(active.pixels[(30 * 80 + 15) * 4 + 3]).toBe(255);
  expect(inactive.pixels[(30 * 80 + 15) * 4 + 3]).toBe(0);
  expect(p.production.drawingSequence(track.id).drawings).toHaveLength(2);
});

it("validates references, replacement ownership and atomic failures; supports undo and clearing", () => {
  const { p, track, a, panel } = setup(),
    before = p.toJSON();
  for (const keys of [
    [{ frame: 0, drawingId: "missing" }],
    [
      { frame: 1, drawingId: a.id },
      { frame: 1, drawingId: null },
    ],
    [
      { frame: 2, drawingId: a.id },
      { frame: 1, drawingId: null },
    ],
  ]) {
    expect(() => p.production.setDrawingSequence(track.id, keys)).toThrow();
    expect(p.toJSON()).toEqual(before);
  }
  expect(() => p.production.setDrawingSequence(a.id, [])).toThrow(/requires a group/);
  expect(() => p.production.removeLayer(a.id)).toThrow(/revise its exposures/);
  expect(() => p.production.captureComponent(track.id, "animated")).toThrow(/individual drawing/);
  expect(p.toJSON()).toEqual(before);
  const keys = [{ frame: 0, drawingId: a.id }];
  p.production.setDrawingSequence(track.id, keys);
  keys[0]!.frame = 99;
  expect(p.production.drawingSequence(track.id).keys![0]!.frame).toBe(0);
  p.undo();
  const originalTrack = before.panels[0]!.layers[0]!;
  if (originalTrack.kind !== "group") throw new Error("Expected the original drawing group");
  expect(p.production.drawingSequence(track.id).keys).toEqual(originalTrack.drawingSequence);
  p.production.setDrawingSequence(track.id, []);
  expect(p.production.drawingSequence(track.id).keys).toEqual([]);
  p.production.setDrawingSequence(track.id, null);
  expect(p.production.drawingSequence(track.id).keys).toBeNull();
  p.production.removeLayer(a.id);
  const outside = panel.addVectorLayer("Outside");
  expect(() =>
    p.production.setDrawingSequence(track.id, [{ frame: 0, drawingId: outside.id }]),
  ).toThrow(/non-child/);
});

it("persists sequences, remaps duplicated references and ripples frame positions without collapsing keys", async () => {
  const { p, panel, later, track } = setup(),
    path = await mkdtemp(join(tmpdir(), "drawing-sequence-"));
  try {
    const file = join(path, "project.cboard");
    await p.save(file);
    const reopened = await StoryboardProject.open(file);
    expect(reopened.production.drawingSequence(track.id)).toEqual(
      p.production.drawingSequence(track.id),
    );
    const store = ProjectStore.open(file);
    try {
      expect(
        (await renderPanelPNG(store.panelDocument(panel.id), panel.id, { frame: 6 })).equals(
          await renderPanelPNG(p, panel.id, { frame: 6 }),
        ),
      ).toBe(true);
    } finally {
      store.close();
    }
    const before = p.toJSON();
    expect(() => p.production.setPanelDuration(panel.id, 2)).toThrow(/collapses drawing/);
    expect(p.toJSON()).toEqual(before);
    p.production.setPanelDuration(panel.id, 24);
    expect(p.production.drawingSequence(track.id).keys!.map((k) => k.frame)).toEqual([
      4, 8, 13, 17,
    ]);
    expect(p.toJSON().panels.find((q) => q.id === later.id)!.startFrame).toBe(24);
    const copyId = p.production.duplicatePanel(panel.id),
      copy = p.toJSON().panels.find((q) => q.id === copyId)!,
      group = copy.layers[0]!;
    expect(group.kind).toBe("group");
    if (group.kind !== "group") throw new Error("group");
    expect(group.drawingSequence!.map((k) => k.frame)).toEqual([28, 32, 37, 41]);
    expect(group.drawingSequence![0]!.drawingId).toBe(group.children[0]!.id);
    expect(group.drawingSequence![2]!.drawingId).toBe(group.children[0]!.id);
    expect(group.children).toHaveLength(2);
    await p.save(file);
    const again = await StoryboardProject.open(file);
    expect(
      (await renderPanelPNG(again, copyId, { frame: 28 })).equals(
        await renderPanelPNG(p, panel.id, { frame: 4 }),
      ),
    ).toBe(true);
  } finally {
    await rm(path, { recursive: true, force: true });
  }
});
