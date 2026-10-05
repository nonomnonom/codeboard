import { expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StoryboardProject, ProjectStore, renderPanelPNG } from "../../../../src/index.js";
import { setup } from "./fixture.js";

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
