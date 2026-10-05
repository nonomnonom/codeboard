import { expect, it } from "vitest";
import { StoryboardProject } from "../../../../src/index.js";
import { fixture } from "./fixture.js";

it("requires explicit conflict choices and rejects stale previews without changing artwork or origin", () => {
  const { project, panel, component, instance, source, element, child, local } = fixture();
  panel.layer(child.id).edit(local.id, (value) => ({ ...value, opacity: 0.5 }));
  project.production.replaceComponentElement(
    component,
    source.id,
    { ...element, opacity: 0.8 },
    { expectedComponentVersion: 1 },
  );
  const preview = project.previewComponentUpgrade(instance);
  expect(preview.conflictsResolved).toBe(false);
  expect(preview.conflicts).toHaveLength(1);
  const before = project.toJSON();
  expect(() =>
    project.production.upgradeComponentInstance(instance, { expectedInputHash: preview.inputHash }),
  ).toThrow(expect.objectContaining({ code: "REVISION_CONFLICT" }));
  expect(project.toJSON()).toEqual(before);
  const resolutions = { [preview.conflicts[0]!.path]: "local" as const };
  project.production.upgradeComponentInstance(instance, {
    expectedInputHash: preview.inputHash,
    resolutions,
  });
  expect(project.production.element(local.id).opacity).toBe(0.5);
  expect(project.componentOriginData(instance).baselineVersion).toBe(2);
  project.undo();
  expect(project.toJSON().studio.componentOrigins).toEqual(before.studio.componentOrigins);
  panel.layer(child.id).edit(local.id, (value) => ({ ...value, opacity: 0.4 }));
  const changed = project.toJSON();
  expect(() =>
    project.production.upgradeComponentInstance(instance, {
      expectedInputHash: preview.inputHash,
      resolutions,
    }),
  ).toThrow(expect.objectContaining({ code: "REVISION_CONFLICT" }));
  expect(project.toJSON()).toEqual(changed);
});

it("preserves locked corrections and treats local deletions as structural conflicts", () => {
  const { project, component, instance, source, element, child } = fixture();
  project.production.replaceComponentElement(
    component,
    source.id,
    { ...element, opacity: 0.8 },
    { expectedComponentVersion: 1 },
  );
  project.production.lock("layer", child.id, "Review lock");
  const before = project.toJSON();
  const other = StoryboardProject.fromJSON(before, { actor: "agent:other" });
  expect(() =>
    other.production.upgradeComponentInstance(instance, {
      expectedInputHash: other.previewComponentUpgrade(instance).inputHash,
    }),
  ).toThrow();
  expect(other.toJSON()).toEqual(before);
  const removed = fixture();
  const document = removed.project.toJSON();
  const root = document.panels[0]!.layers.find((layer) => layer.id === removed.instance)!;
  if (root.kind !== "group") throw new Error("Missing root");
  root.children = [];
  const deleted = StoryboardProject.fromJSON(document);
  deleted.production.replaceComponentElement(
    removed.component,
    removed.source.id,
    { ...removed.element, opacity: 0.8 },
    { expectedComponentVersion: 1 },
  );
  const preview = deleted.previewComponentUpgrade(removed.instance);
  expect(preview.conflicts).toEqual([
    expect.objectContaining({ kind: "structure", resolution: "unresolved" }),
  ]);
  deleted.production.upgradeComponentInstance(removed.instance, {
    expectedInputHash: preview.inputHash,
    resolutions: { [preview.conflicts[0]!.path]: "local" },
  });
  expect(
    deleted
      .componentOriginData(removed.instance)
      .items.every((entry) => entry.location === "missing"),
  ).toBe(true);
});
