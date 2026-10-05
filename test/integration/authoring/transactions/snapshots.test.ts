import { expect, it, vi } from "vitest";
import { renderPanelPNG } from "../../../../src/index.js";
import { fixture } from "./fixture.js";

it("copies a locally edited panel once and never snapshots unrelated panels", async () => {
  const { project, first, ink, id } = fixture(),
    original = project.toJSON(),
    image = await renderPanelPNG(project, "first");
  const spy = vi.spyOn(globalThis, "structuredClone");
  try {
    project.transaction("Two edits", () => {
      ink.edit(id, (e) => ({ ...e, opacity: 0.25 }));
      first.revise({ notes: "Revised" });
      project.setMetadata("review", "local");
    });
    const inputs = spy.mock.calls.map(([value]) =>
      value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {},
    );
    expect(inputs.filter((v) => v?.id === "first")).toHaveLength(1);
    expect(inputs.some((v) => v?.id === "second" || v?.schemaVersion !== undefined)).toBe(false);
  } finally {
    spy.mockRestore();
  }
  const edited = await renderPanelPNG(project, "first");
  expect(edited.equals(image)).toBe(false);
  project.undo();
  expect(project.toJSON().panels).toEqual(original.panels);
  expect(await renderPanelPNG(project, "first")).toEqual(image);
  project.redo();
  expect(await renderPanelPNG(project, "first")).toEqual(edited);
});

it("rolls back local edits followed by a failing global retime", () => {
  const { project, first, second, ink, id } = fixture();
  project.production.addLayerKeyframe(ink.id, 0, { opacity: 1 });
  project.production.addLayerKeyframe(ink.id, 1, { opacity: 0.5 });
  const before = project.toJSON(),
    undo = project.canUndo,
    redo = project.canRedo;
  expect(() =>
    project.transaction("Failure after several scopes", () => {
      first.revise({ notes: "Do not retain" });
      second.revise({ title: "Do not retain either" });
      project.setMetadata("review", "temporary");
      ink.edit(id, (e) => ({ ...e, opacity: 0.2 }));
      project.production.setPanelDuration("first", 1);
    }),
  ).toThrow(/collapses keyframes/);
  expect(project.toJSON()).toEqual(before);
  expect(project.canUndo).toBe(undo);
  expect(project.canRedo).toBe(redo);
});

it("shares untouched panels during local animation revisions and restores failures exactly", () => {
  const { project, ink, first } = fixture(),
    before = project.toJSON();
  const spy = vi.spyOn(globalThis, "structuredClone");
  try {
    project.transaction("Revise local animation", () => {
      project.production.setTransition(first.id, { type: "dissolve", durationFrames: 4 });
      project.production.setExposure(ink.id, { startFrame: 0, endFrame: 20 });
      const key = project.production.addLayerKeyframe(ink.id, 0, { opacity: 0.5 });
      project.production.updateLayerKeyframe(ink.id, key, { opacity: 0.8 });
      const removed = project.production.addLayerKeyframe(ink.id, 10, { opacity: 1 });
      project.production.removeLayerKeyframe(ink.id, removed);
    });
    const inputs = spy.mock.calls.map(([value]) =>
      value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {},
    );
    expect(inputs.filter((v) => v?.id === "first")).toHaveLength(1);
    expect(inputs.some((v) => v?.id === "second" || v?.schemaVersion !== undefined)).toBe(false);
  } finally {
    spy.mockRestore();
  }
  const after = project.toJSON();
  expect(after.panels[0]!.layers[0]!.keyframes).toHaveLength(1);
  expect(after.panels[0]!.layers[0]!.keyframes[0]!.opacity).toBe(0.8);
  project.undo();
  expect(project.toJSON().panels).toEqual(before.panels);
  project.redo();
  expect(project.toJSON().panels).toEqual(after.panels);
  const restored = project.toJSON();
  expect(() =>
    project.transaction("Fail after animation edit", () => {
      project.production.setExposure(ink.id, null);
      project.production.addLayerKeyframe(ink.id, 12, { opacity: 0.2 });
      project.production.setTransition(first.id, { type: "dissolve", durationFrames: 24 });
    }),
  ).toThrow(/fit inside/);
  expect(project.toJSON()).toEqual(restored);
});

it("preserves an active local updater when a nested operation needs a document snapshot", () => {
  const { project, ink, id } = fixture();
  ink.edit(id, (e) => {
    project.production.addAudioTrack("Scratch");
    return { ...e, opacity: 0.3 };
  });
  expect(project.toJSON().audioTracks).toHaveLength(1);
  const edited = project.production.layer(ink.id);
  if (edited.kind === "group") throw new Error("Expected drawing");
  expect(edited.elements[0]!.opacity).toBe(0.3);
  project.undo();
  expect(project.toJSON().audioTracks).toHaveLength(0);
  const restored = project.production.layer(ink.id);
  if (restored.kind === "group") throw new Error("Expected drawing");
  expect(restored.elements[0]!.opacity).toBe(1);
});
