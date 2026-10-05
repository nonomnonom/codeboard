import { expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StoryboardProject, renderPanelPNG, evaluateDrawing } from "../../../../src/index.js";
import { setup } from "./fixture.js";

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
