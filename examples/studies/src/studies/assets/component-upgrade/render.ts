import assert from "node:assert/strict";
import { join } from "node:path";
import {
  StoryboardProject,
  renderPanelPNG,
  renderShotFramePNG,
  createShotRenderSession,
} from "codeboard-studio";
import { blue, save } from "../../../shared.ts";
import { report, comparison } from "../../../shared/artifacts.ts";
import { author } from "./author.ts";
import { capturePerformance } from "./performance.ts";

export async function generate(output: string): Promise<void> {
  const { project, panel, componentId, instanceId, source, local } = author();
  const original = await renderPanelPNG(project, panel.id);
  const elementId = local.elements[0]!.id;
  panel.layer(local.id).edit(elementId, (element) => {
    if (element.kind !== "vector-path") throw new Error("Expected kite contour");
    return { ...element, fill: blue };
  });
  const corrected = await renderPanelPNG(project, panel.id);
  const baseline = project.componentOriginData(instanceId);
  const performance = capturePerformance(project, panel.id, instanceId, local.id);
  project.production.replaceComponentElement(
    componentId,
    source.id,
    {
      ...source.elements[0]!,
      matrix: [1, 0.2, -0.2, 1, 14, 0],
    },
    { expectedComponentVersion: 1 },
  );
  assert.deepEqual(await renderPanelPNG(project, panel.id), corrected);
  const preview = project.previewComponentUpgrade(instanceId);
  assert.equal(preview.conflictsResolved, true);
  const shotPreview = project.previewComponentUpgrade(performance.instanceId);
  assert.equal(shotPreview.conflictsResolved, true);
  const file = join(output, "component-upgrade.cboard");
  await project.save(file);
  const plan = project.plan("Upgrade kite without losing its local paint", [
    {
      op: "component.upgrade",
      id: instanceId,
      expectedInputHash: preview.inputHash,
    },
    {
      op: "component.upgrade",
      id: performance.instanceId,
      expectedInputHash: shotPreview.inputHash,
    },
  ]);
  const committed = await project.commit(plan, { requestId: "kite:upgrade" });
  const reopened = await StoryboardProject.open(file);
  assert.equal((await reopened.commit(plan, { requestId: "kite:upgrade" })).replayed, true);
  const element = reopened.production.element(elementId);
  assert.equal(element.kind, "vector-path");
  if (element.kind === "vector-path") assert.equal(element.fill, blue);
  assert.deepEqual(element.matrix, [1, 0.2, -0.2, 1, 14, 0]);
  const animation = reopened.shotAnimation(performance.animationId);
  const root = animation.layers.find((layer) => layer.id === performance.instanceId)!;
  const oldRoot = performance.before.layers.find((layer) => layer.id === performance.instanceId)!;
  assert.equal(root.kind, "group");
  if (root.kind !== "group" || oldRoot.kind !== "group" || root.children[0]!.kind === "group")
    throw new Error("Missing animated kite");
  assert.deepEqual(root.children[0]!.keyframes, oldRoot.children[0]!.keyframes);
  assert.deepEqual(animation.controllers, performance.before.controllers);
  const shotElement = root.children[0]!.elements[0]!;
  assert.equal(shotElement.kind, "vector-path");
  if (shotElement.kind === "vector-path") assert.equal(shotElement.fill, blue);
  assert.deepEqual(shotElement.matrix, element.matrix);
  const session = createShotRenderSession(animation);
  for (const frame of [23, 3, 12, 0, 3])
    assert.deepEqual(await session.png(frame), await renderShotFramePNG(animation, frame));
  await save(
    output,
    "component-upgrade",
    reopened,
    await comparison(output, "Update the shape, keep your paint", [
      { label: "Library version 1", png: original },
      { label: "Local paint correction", png: corrected },
      { label: "Version 2 · correction retained", png: await renderPanelPNG(reopened, panel.id) },
    ]),
  );
  await report(output, "upgrade", {
    baseline,
    preview,
    shotPreview,
    shotAfter: reopened.componentOriginData(performance.instanceId),
    keysAndControllersPreserved: true,
    plan,
    committed,
    after: reopened.componentOriginData(instanceId),
  });
}
