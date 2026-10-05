import { expect, it, vi } from "vitest";
import { decodePixels, renderOnionSkin } from "../../../../src/index.js";
import { setup } from "./fixture.js";

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
    spy = vi.spyOn(p, "toJSON").mockImplementation(() => {
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
