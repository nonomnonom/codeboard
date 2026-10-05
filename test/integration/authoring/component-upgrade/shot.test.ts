import { expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  StoryboardProject,
  renderShotFramePNG,
  createShotRenderSession,
} from "../../../../src/index.js";
import { fixture } from "./fixture.js";

it("upgrades a captured shot instance without changing its keys, controllers or board sibling", async () => {
  const { project, panel, component, instance, source, element, child, local } = fixture();
  const capture = project.capturePanelAnimation(panel.id, { id: "animation:upgrade" });
  const mapped = (id: string) =>
    capture.identities.find((entry) => entry.sourceId === id)!.capturedId;
  const instanceId = mapped(instance),
    layerId = mapped(child.id),
    elementId = mapped(local.id);
  project.reviseShotElement(capture.animationId, layerId, elementId, {
    ...local,
    id: elementId,
    opacity: 0.5,
  });
  project.editShotAnimation(capture.animationId, [
    {
      op: "layer.key.put",
      layerId,
      key: { id: "key:upgrade-start", frame: 0, transform: { x: 0 }, easing: "linear" },
    },
    {
      op: "layer.key.put",
      layerId,
      key: { id: "key:upgrade-end", frame: 20, transform: { x: 10 }, easing: "linear" },
    },
    {
      op: "controller.put",
      controller: {
        id: "controller:upgrade",
        name: "Lift",
        mode: "additive",
        weight: 1,
        targets: [{ layerId, values: { y: -3 } }],
        keyframes: [],
      },
    },
  ]);
  const before = project.shotAnimation(capture.animationId);
  const board = project.production.layer(instance);
  project.production.replaceComponentElement(
    component,
    source.id,
    { ...element, matrix: [1, 0, 0, 1, 8, 0] },
    { expectedComponentVersion: 1 },
  );
  const preview = project.previewComponentUpgrade(instanceId);
  expect(preview.owner).toEqual({ kind: "animation", id: capture.animationId });
  expect(preview.conflictsResolved).toBe(true);
  const lock = project.production.lock("layer", layerId, "Shot correction reviewed");
  const locked = project.toJSON();
  const other = StoryboardProject.fromJSON(locked, { actor: "agent:other" });
  expect(() =>
    other.production.upgradeComponentInstance(instanceId, {
      expectedInputHash: preview.inputHash,
    }),
  ).toThrow(/Locked/);
  expect(other.toJSON()).toEqual(locked);
  project.production.unlock(lock);
  const directory = await mkdtemp(join(tmpdir(), "codeboard-shot-upgrade-"));
  try {
    const file = join(directory, "shot.cboard");
    await project.save(file);
    const plan = project.plan("Upgrade captured prop", [
      { op: "component.upgrade", id: instanceId, expectedInputHash: preview.inputHash },
    ]);
    await project.commit(plan, { requestId: "shot-upgrade" });
    const reopened = await StoryboardProject.open(file);
    expect((await reopened.commit(plan, { requestId: "shot-upgrade" })).replayed).toBe(true);
    const after = reopened.shotAnimation(capture.animationId);
    expect(after.controllers).toEqual(before.controllers);
    const root = after.layers.find((layer) => layer.id === instanceId)!;
    const oldRoot = before.layers.find((layer) => layer.id === instanceId)!;
    if (root.kind !== "group" || oldRoot.kind !== "group") throw new Error("Missing instance");
    expect(root.children[0]!.keyframes).toEqual(oldRoot.children[0]!.keyframes);
    expect(reopened.production.layer(instance)).toEqual(board);
    const reference = structuredClone(before);
    const referenceRoot = reference.layers.find((layer) => layer.id === instanceId)!;
    if (referenceRoot.kind !== "group" || referenceRoot.children[0]!.kind === "group")
      throw new Error("Missing reference");
    referenceRoot.children[0]!.elements[0]!.matrix = [1, 0, 0, 1, 8, 0];
    const session = createShotRenderSession(after);
    for (const frame of [20, 3, 12, 0, 3])
      expect(await session.png(frame)).toEqual(await renderShotFramePNG(reference, frame));
    expect(reopened.componentOriginData(instanceId).baselineVersion).toBe(2);
    expect(reopened.componentOriginData(instance).baselineVersion).toBe(1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("preflights fresh identities for added source artwork and pins the chosen mapping", () => {
  const original = fixture();
  const removedInstance = original.project.production.instantiateComponent(
    original.component,
    original.panel.id,
  );
  const reservedCopyId = original.project.componentOriginData(removedInstance).items[0]!.copyId;
  const document = original.project.toJSON();
  document.panels[0]!.layers = document.panels[0]!.layers.filter(
    (layer) => layer.id !== removedInstance,
  );
  const source = document.components[0]!.layers[0]!;
  if (source.kind === "group") throw new Error("Missing source");
  source.elements.push({
    ...structuredClone(source.elements[0]!),
    id: "element:library-added",
    matrix: [1, 0, 0, 1, 16, 0],
  });
  document.components[0]!.version++;
  const project = StoryboardProject.fromJSON(document);
  expect(() => project.previewComponentUpgrade(original.instance)).toThrow(
    expect.objectContaining({
      details: expect.objectContaining({ reason: "COMPONENT_UPGRADE_IDENTITY" }),
    }),
  );
  const newIdentities = [{ sourceId: "element:library-added", copyId: "element:instance-added" }];
  const preview = project.previewComponentUpgrade(original.instance, { newIdentities });
  expect(preview.conflictsResolved).toBe(true);
  const before = project.toJSON();
  expect(() =>
    project.production.upgradeComponentInstance(original.instance, {
      expectedInputHash: preview.inputHash,
      newIdentities: [{ sourceId: "element:library-added", copyId: "element:different" }],
    }),
  ).toThrow(expect.objectContaining({ code: "REVISION_CONFLICT" }));
  expect(project.toJSON()).toEqual(before);
  for (const copyId of [
    original.source.id,
    document.id,
    original.local.id,
    reservedCopyId,
    removedInstance,
  ])
    expect(() =>
      project.previewComponentUpgrade(original.instance, {
        newIdentities: [{ sourceId: "element:library-added", copyId }],
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_ARGUMENT" }));
  expect(project.toJSON()).toEqual(before);
  project.production.upgradeComponentInstance(original.instance, {
    expectedInputHash: preview.inputHash,
    newIdentities,
  });
  expect(project.production.element("element:instance-added").matrix).toEqual([1, 0, 0, 1, 16, 0]);
  expect(project.production.element(original.local.id)).toEqual(original.local);
  expect(project.componentOriginData(original.instance).items).toContainEqual({
    ...newIdentities[0],
    location: "instance",
  });
});
