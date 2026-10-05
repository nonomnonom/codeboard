import { expect, it, vi } from "vitest";
import { fixture } from "./fixture.js";

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
    spy = vi.spyOn(globalThis, "structuredClone");
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
