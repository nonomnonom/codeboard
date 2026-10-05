import { join } from "node:path";
import { StoryboardProject, evaluateLayer, renderShotFramePNG } from "codeboard-studio";
import { amber, ink, make, save } from "../../shared.ts";
import { report, sheet } from "../../shared/artifacts.ts";

export async function render(output: string): Promise<void> {
  const project = make("Persisted two-bone rest pose");
  const panel = project
    .addScene("Study")
    .addShot("Reach and return")
    .addPanel({ durationFrames: 24 });
  const root = panel.addGroup("Shoulder", { transform: { x: 90, y: 170, rotation: -0.6 } });
  const elbow = panel.addGroup("Elbow", { transform: { x: 100, rotation: 0.9 } }, root.id);
  panel.addVectorLayer("Upper arm", {}, root.id).vectorStroke(
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    { width: 18, color: ink },
  );
  panel.addVectorLayer("Forearm", {}, elbow.id).vectorStroke(
    [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
    ],
    { width: 14, color: amber },
  );
  project.production.setTwoBoneRig(root.id, {
    elbowId: elbow.id,
    upperLength: 100,
    lowerLength: 80,
  });
  project.production.addLayerKeyframe(root.id, 0, {
    transform: { x: 90, y: 170, rotation: -0.6 },
    easing: "linear",
  });
  project.production.addLayerKeyframe(elbow.id, 0, {
    transform: { rotation: 0.9 },
    easing: "linear",
  });
  const captured = project.capturePanelAnimation(panel.id, { id: "animation:rig-rest" });
  const rootId = captured.identities.find((entry) => entry.sourceId === root.id)!.capturedId;
  const path = join(output, "rig-rest.cboard");
  await project.save(path);
  const capturePlan = project.plan("Capture rest, then reach", [
    {
      op: "animation.edit",
      id: captured.animationId,
      edits: [
        { op: "layer.rig.rest.capture", layerId: rootId, frame: 0 },
        {
          op: "layer.rig.pose",
          layerId: rootId,
          frame: 12,
          target: { x: 180, y: 70 },
          bend: 1,
          unreachable: "reject",
          rootKeyId: "rest-study:root-reach",
          elbowKeyId: "rest-study:elbow-reach",
          easing: "ease-in-out",
        },
      ],
    },
  ]);
  const captureReceipt = await project.commit(capturePlan, { requestId: "study:rest-capture" });
  const reopened = await StoryboardProject.open(path);
  const restorePlan = reopened.plan("Restore saved rest", [
    {
      op: "animation.edit",
      id: captured.animationId,
      edits: [
        {
          op: "layer.rig.rest.apply",
          layerId: rootId,
          frame: 23,
          rootKeyId: "rest-study:root-return",
          elbowKeyId: "rest-study:elbow-return",
          easing: "ease-in-out",
        },
      ],
    },
  ]);
  const restored = await reopened.commit(restorePlan, { requestId: "study:rest-apply" });
  const replayed = await reopened.commit(restorePlan, { requestId: "study:rest-apply" });
  const final = await StoryboardProject.open(path);
  const animation = final.shotAnimation(captured.animationId);
  const savedRoot = animation.layers.find((layer) => layer.id === rootId);
  if (savedRoot?.kind !== "group" || !savedRoot.twoBoneRig?.restPose)
    throw new Error("Rest study is missing its persisted root pose");
  const savedElbow = savedRoot.children.find((layer) => layer.id === savedRoot.twoBoneRig!.elbowId);
  if (!savedElbow) throw new Error("Rest study is missing its elbow");
  const samples = [];
  for (const [frame, label] of [
    [0, "Captured rest"],
    [12, "IK reach"],
    [23, "Restored after reopen"],
  ] as const)
    samples.push({ label, png: await renderShotFramePNG(animation, frame) });
  await save(output, "rig-rest", final, await sheet("Saved rest pose", samples));
  await report(output, "rest-pose", {
    capturePlan,
    captureReceipt,
    restorePlan,
    restored,
    replayed,
    restPose: savedRoot.twoBoneRig.restPose,
    rootKeys: savedRoot.keyframes,
    elbowKeys: savedElbow.keyframes,
    frames: [0, 12, 23].map((frame) => ({
      frame,
      root: evaluateLayer(savedRoot, frame).transform,
      elbow: evaluateLayer(savedElbow, frame).transform,
    })),
  });
}
