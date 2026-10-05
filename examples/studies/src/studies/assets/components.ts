import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { report } from "../../shared/artifacts.ts";
import {
  StoryboardProject,
  pathCommands,
  renderFramePNG,
  renderShotFramePNG,
  planComponentSource,
} from "codeboard-studio";
import { amber, ink, make, rect, save, text } from "../../shared.ts";
export async function generate(output: string): Promise<void> {
  const project = make("Static components", 900, 360);
  const panel = project.addScene("Study").addShot("Repeated prop").addPanel({ durationFrames: 1 });
  const source = panel.addGroup("Lamp source");
  const art = panel.addVectorLayer("Lamp geometry", {}, source.id);
  rect(art, 0, 0, 12, 130, ink);
  art.path(pathCommands("M -40 0 L -25 -45 L 37 -45 L 52 0 Z"), { fill: amber });
  rect(art, -25, 130, 62, 10, ink);
  const component = project.production.captureComponent(source.id, "Lamp");
  source.set({ visible: false });
  const instances: string[] = [];
  for (const [x, scale] of [
    [150, 1],
    [410, 0.7],
    [675, 1.3],
  ] as const) {
    instances.push(
      project.production.instantiateComponent(component, panel.id, {
        x,
        y: 110,
        scaleX: scale,
        scaleY: scale,
      }),
    );
  }
  const labels = panel.addVectorLayer("Labels");
  text(labels, "1.0x", 132, 318);
  text(labels, "0.7x", 392, 318);
  text(labels, "1.3x", 657, 318);
  const captured = project.capturePanelAnimation(panel.id, { id: "component-shot" });
  const shotInstanceId = captured.identities.find(
    (entry) => entry.sourceId === instances[0],
  )!.capturedId;
  await save(output, "components", project, await renderFramePNG(project, 0));
  const reopened = await StoryboardProject.open(join(output, "components.cboard"));
  const library = reopened.toJSON().components.find((entry) => entry.id === component)!;
  const root = library.layers[0]!;
  const drawing = root.kind === "group" ? root.children[0]! : root;
  if (drawing.kind === "group" || !drawing.elements[0])
    throw new Error("Component study requires source artwork");
  drawing.elements[0] = { ...drawing.elements[0], matrix: [1, 0, 0, 1, 0, 3] };
  const addedSourceId = "lamp-source-added-detail";
  drawing.elements.push({
    ...structuredClone(drawing.elements[0]),
    id: addedSourceId,
    matrix: [1, 0, 0, 0.15, 18, 104],
  });
  const sourcePlan = reopened.plan("Revise source with retained identity", [
    {
      op: "component.source.replace",
      componentId: component,
      expectedComponentVersion: library.version,
      layers: planComponentSource(library.layers),
    },
  ]);
  const sourceReceipt = await reopened.commit(sourcePlan, { requestId: "study:component-source" });
  const revised = await StoryboardProject.open(join(output, "components.cboard"));
  const instanceId = instances[0]!;
  const localDrawing = revised
    .componentOriginData(instanceId)
    .items.find((entry) => entry.sourceId === drawing.id)!.copyId;
  revised.panel(panel.id).layer(localDrawing).set({ opacity: 0.8 });
  const shotDrawing = revised
    .componentOriginData(shotInstanceId)
    .items.find((entry) => entry.sourceId === drawing.id)!.copyId;
  revised.editShotAnimation(captured.animationId, [
    {
      op: "layer.key.put",
      layerId: shotDrawing,
      key: { id: "component-shot-opacity", frame: 0, opacity: 0.7, transform: {}, easing: "hold" },
    },
    {
      op: "controller.put",
      controller: {
        id: "component-shot-offset",
        name: "Local lamp offset",
        mode: "additive",
        weight: 1,
        targets: [{ layerId: shotDrawing, values: { x: 4 } }],
        keyframes: [],
      },
    },
  ]);
  await revised.save(join(output, "components.cboard"));
  const newIdentities = [{ sourceId: addedSourceId, copyId: "lamp-board-added-detail" }];
  const shotNewIdentities = [{ sourceId: addedSourceId, copyId: "lamp-shot-added-detail" }];
  const preview = revised.previewComponentUpgrade(instanceId, { newIdentities });
  const shotPreview = revised.previewComponentUpgrade(shotInstanceId, {
    newIdentities: shotNewIdentities,
  });
  const upgradePlan = revised.plan("Preserve local opacity while upgrading source geometry", [
    {
      op: "component.upgrade",
      id: instanceId,
      expectedInputHash: preview.inputHash,
      newIdentities,
    },
    {
      op: "component.upgrade",
      id: shotInstanceId,
      expectedInputHash: shotPreview.inputHash,
      newIdentities: shotNewIdentities,
    },
  ]);
  const upgradeReceipt = await revised.commit(upgradePlan, {
    requestId: "study:component-upgrade",
  });
  const upgraded = await StoryboardProject.open(join(output, "components.cboard"));
  await save(output, "components", upgraded, await renderFramePNG(upgraded, 0));
  const upgradedShot = upgraded.shotAnimation(captured.animationId);
  await writeFile(join(output, "components-shot.png"), await renderShotFramePNG(upgradedShot, 0));
  await report(output, "component-upgrade", {
    preview,
    shotPreview,
    upgradePlan,
    upgradeReceipt,
    shotOrigin: upgraded.componentOriginData(shotInstanceId),
    dependencies: upgraded.shotDependencyData(captured.animationId),
    shotControllers: upgradedShot.controllers,
  });
  await report(output, "component-source-revision", { sourcePlan, sourceReceipt });
  await report(
    output,
    "component-origins",
    instances.map((id) => upgraded.componentOriginData(id)),
  );
}
