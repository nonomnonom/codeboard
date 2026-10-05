import { join } from "node:path";
import { StoryboardProject, renderShotFramePNG } from "codeboard-studio";
import { amber, ink, make, rect, save } from "../../shared.ts";
import { report, sheet } from "../../shared/artifacts.ts";

export async function render(output: string): Promise<void> {
  const project = make("Weighted replacement and additive poses");
  const panel = project.addScene("Study").addShot("Pose baking").addPanel({ durationFrames: 24 });
  const ground = panel.addVectorLayer("Ground");
  rect(ground, 20, 190, 320, 3, ink);
  const actor = panel.addVectorLayer("Pose marker");
  rect(actor, -20, -45, 40, 90, amber);
  rect(actor, 10, -30, 35, 10, ink);
  project.production.addLayerKeyframe(actor.id, 0, {
    transform: { x: 60, y: 140, rotation: 0, scaleY: 1 },
    easing: "linear",
  });
  const capture = project.capturePanelAnimation(panel.id, { id: "animation:pose" });
  const actorId = capture.identities.find((entry) => entry.sourceId === actor.id)!.capturedId;
  const path = join(output, "weighted-pose.cboard");
  await project.save(path);
  const plan = project.plan("Bake weighted poses", [
    {
      op: "animation.edit",
      id: capture.animationId,
      edits: [
        {
          op: "layer.pose",
          layerId: actorId,
          frame: 12,
          keyId: "pose:middle",
          mode: "replace",
          weight: 0.5,
          values: { x: 300 },
          easing: "linear",
        },
        {
          op: "layer.pose",
          layerId: actorId,
          frame: 23,
          keyId: "pose:end",
          mode: "additive",
          weight: 1,
          values: { x: 90, rotation: 0.3, scaleY: 0.1 },
          easing: "linear",
        },
      ],
    },
  ]);
  const committed = await project.commit(plan, { requestId: "study:weighted-pose" });
  const replayed = await project.commit(plan, { requestId: "study:weighted-pose" });
  const reopened = await StoryboardProject.open(path);
  const animation = reopened.shotAnimation(capture.animationId);
  const actorLayer = animation.layers.find((layer) => layer.id === actorId)!;
  const samples = [];
  for (const [frame, label] of [
    [0, "Base x = 60"],
    [12, "Halfway to 300: x = 180"],
    [23, "Add 90: x = 270"],
  ] as const)
    samples.push({ label, png: await renderShotFramePNG(animation, frame) });
  await save(output, "weighted-pose", reopened, await sheet("Weighted poses", samples));
  await report(output, "pose-bake", {
    plan,
    committed,
    replayed,
    keysAfterReopen: actorLayer.keyframes,
    semantics:
      "Replacement samples the draft; additive values are numeric deltas. Durable retry reuses the receipt.",
  });
}
