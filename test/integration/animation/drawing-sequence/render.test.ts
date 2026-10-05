import { expect, it, vi } from "vitest";
import {
  pathCommands,
  renderPanelPNG,
  decodePixels,
  renderOnionSkin,
  evaluateDrawing,
  createRenderSession,
} from "../../../../src/index.js";
import { setup } from "./fixture.js";

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
  const spy = vi.spyOn(p, "toJSON").mockImplementation(() => {
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
