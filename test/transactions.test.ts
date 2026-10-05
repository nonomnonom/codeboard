afterEach(() => jest.restoreAllMocks());

import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StoryboardProject, createPixels, renderPanelPNG } from "../src/index.js";

function fixture() {
  const project = StoryboardProject.create({
    title: "Transaction isolation",
    width: 64,
    height: 64,
  });
  const shot = project.addScene("Scene").addShot("Shot");
  const first = shot.addPanel({ id: "first", durationFrames: 24 }),
    second = shot.addPanel({ id: "second", durationFrames: 24 });
  const ink = first.addVectorLayer("Ink"),
    id = ink.vectorStroke(
      [
        { x: 4, y: 4 },
        { x: 48, y: 48 },
      ],
      { width: 6 },
    );
  const paint = second.addRasterLayer("Pixels");
  paint.rasterSurface(createPixels(64, 64));
  return { project, first, second, ink, id };
}

it("rejects invalid layer settings before changing any field inside a transaction", () => {
  const { project, ink } = fixture(),
    initial = project.toJSON();
  project.transaction("Correct layer settings", () => {
    const before = project.toJSON();
    for (const changes of [
      { name: "Partial edit", opacity: 2 },
      { opacity: NaN },
      { visible: "yes" },
      { blendMode: "unsupported" },
      { transform: { x: Infinity, y: 0, scaleX: 1, scaleY: 1, rotation: 0 } },
      { transform: { x: 2 } },
      { id: "replacement" },
      { kind: "group" },
      { maskLayerId: 42 },
    ]) {
      expect(() => ink.set(changes as never)).toThrow();
      expect(project.toJSON()).toEqual(before);
    }
    const transform = { x: 3, y: 4, scaleX: -1, scaleY: 1, rotation: 0.2 };
    ink.set({ name: "Corrected", opacity: 0.6, transform, maskLayerId: null });
    transform.x = 99;
    ink.set({ name: undefined, opacity: undefined, transform: undefined } as never);
    expect(project.production.layer(ink.id)).toMatchObject({
      name: "Corrected",
      opacity: 0.6,
      transform: { x: 3, scaleX: -1 },
    });
  });
  project.undo();
  expect(project.toJSON().panels).toEqual(initial.panels);
  project.redo();
  expect(project.production.layer(ink.id).name).toBe("Corrected");
});

it.each(["undo", "redo"] as const)(
  "rejects %s during authoring without consuming history",
  (operation) => {
    const { project, first } = fixture();
    first.revise({ notes: "Retained edit" });
    if (operation === "redo") project.undo();
    const before = project.toJSON(),
      canUndo = project.canUndo,
      canRedo = project.canRedo;
    expect(() =>
      project.transaction("Invalid history operation", () => {
        first.revise({ title: "Temporary" });
        project[operation]();
      }),
    ).toThrow(/transaction/);
    expect(project.toJSON()).toEqual(before);
    expect(project.canUndo).toBe(canUndo);
    expect(project.canRedo).toBe(canRedo);
    expect(project[operation]()).toBe(true);
    expect(project.toJSON().panels[0]!.notes).toBe(operation === "undo" ? "" : "Retained edit");
  },
);

it("rejects saving uncommitted artwork without touching an existing or new file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-transaction-"));
  try {
    const { project, first } = fixture(),
      file = join(directory, "project.cboard"),
      newFile = join(directory, "new.cboard");
    await project.save(file);
    const bytes = await readFile(file),
      original = project.toJSON();
    let existing!: Promise<void>, fresh!: Promise<void>;
    expect(() =>
      project.transaction("Failed edit", () => {
        first.revise({ notes: "Uncommitted" });
        existing = project.save(file);
        fresh = project.save(newFile);
        throw new Error("Cancel the edit");
      }),
    ).toThrow(/Cancel the edit/);
    await expect(existing).rejects.toThrow(/transaction/);
    await expect(fresh).rejects.toThrow(/transaction/);
    expect(await readFile(file)).toEqual(bytes);
    await expect(stat(newFile)).rejects.toMatchObject({ code: "ENOENT" });
    expect(project.toJSON()).toEqual(original);
    first.revise({ notes: "Committed" });
    await project.save(file);
    expect((await StoryboardProject.open(file)).toJSON().panels[0]!.notes).toBe("Committed");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("copies a locally edited panel once and never snapshots unrelated panels", async () => {
  const { project, first, ink, id } = fixture(),
    original = project.toJSON(),
    image = await renderPanelPNG(project, "first");
  const spy = jest.spyOn(globalThis, "structuredClone");
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
  const spy = jest.spyOn(globalThis, "structuredClone");
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

it("does not remove a layer when a rejected move is caught inside the transaction", () => {
  const { project, ink } = fixture();
  project.transaction("Handle bad destination", () => {
    const before = project.toJSON();
    expect(() => project.production.moveLayer(ink.id, "missing-layer")).toThrow(/sibling/);
    expect(project.toJSON()).toEqual(before);
    project.setMetadata("handled", "yes");
  });
  expect(project.toJSON().metadata.handled).toBe("yes");
});

it("does not move earlier keys when a retime collision is caught inside the transaction", () => {
  const { project, ink } = fixture();
  project.production.addLayerKeyframe(ink.id, 1, { opacity: 0.5 });
  project.production.addLayerKeyframe(ink.id, 2, { opacity: 1 });
  project.transaction("Handle colliding keys", () => {
    const before = project.toJSON();
    expect(() => project.production.setPanelDuration("first", 1)).toThrow(/collapses/);
    expect(project.toJSON()).toEqual(before);
    project.setMetadata("handled", "yes");
  });
  expect(project.toJSON().metadata.handled).toBe("yes");
});

it("scopes layer ordering, removal and component instances to their owning panel", () => {
  const { project, first, ink } = fixture();
  const component = project.production.captureComponent(ink.id, "Reusable ink");
  const instance = project.production.instantiateComponent(component, first.id, { x: 12 });
  project.production.comment("Remove with instance", { panelId: first.id, layerId: instance });
  project.production.comment("Keep with ink", { panelId: first.id, layerId: ink.id });
  const before = project.toJSON(),
    spy = jest.spyOn(globalThis, "structuredClone");
  let extra = "";
  try {
    project.transaction("Revise layout and local instances", () => {
      extra = project.production.instantiateComponent(component, first.id, { x: 24 });
      project.production.refreshComponentInstance(instance);
      project.production.moveLayer(ink.id);
      project.production.removeLayer(instance);
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
  expect(after.panels[1]).toEqual(before.panels[1]);
  expect(after.components).toEqual(before.components);
  expect(after.comments.map((c) => c.body)).toEqual(["Keep with ink"]);
  expect(after.panels[0]!.layers.at(-1)!.id).toBe(ink.id);
  expect(after.panels[0]!.layers.some((l) => l.id === extra)).toBe(true);
  project.undo();
  expect(project.toJSON().panels).toEqual(before.panels);
  expect(project.toJSON().comments).toEqual(before.comments);
  project.redo();
  expect(project.toJSON().panels).toEqual(after.panels);
  expect(project.toJSON().comments).toEqual(after.comments);
});

it("restores review anchors after a scoped layer deletion is rolled back", () => {
  const { project, first, ink, id } = fixture();
  project.production.comment("Drawing note", { panelId: first.id, layerId: ink.id, elementId: id });
  const before = project.toJSON();
  expect(() =>
    project.transaction("Cancel removal", () => {
      project.production.removeLayer(ink.id);
      expect(project.toJSON().comments).toEqual([]);
      throw new Error("Cancel deletion");
    }),
  ).toThrow(/Cancel deletion/);
  expect(project.toJSON()).toEqual(before);
  expect(project.production.element(id).id).toBe(id);
});
