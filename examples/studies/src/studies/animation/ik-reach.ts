import { renderFramePNG } from "codeboard-studio";
import { amber, blue, ink, make, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";
export async function generate(output: string): Promise<void> {
  const project = make("Two-bone reach");
  const shot = project.addScene("Study").addShot("Reach limits");
  for (const [index, target] of [
    [0, { x: 230, y: 120 }],
    [1, { x: 190, y: 80 }],
    [2, { x: 330, y: 110 }],
  ] as const) {
    const panel = shot.addPanel({
      title: index === 2 ? "Outside reach" : `Reach ${index + 1}`,
      durationFrames: 1,
    });
    const root = panel.addGroup("Shoulder", { transform: { x: 90, y: 180 } });
    const elbow = panel.addGroup("Elbow", { transform: { x: 100, y: 0 } }, root.id);
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
    const result = project.production.poseTwoBoneRig(root.id, index, target, {
      bend: 1,
      easing: "hold",
    });
    if (result.reachable !== (index !== 2)) throw new Error("Unexpected reach result");
    const markers = panel.addVectorLayer("Target");
    markers.vectorStroke(
      [
        { x: target.x - 8, y: target.y },
        { x: target.x + 8, y: target.y },
      ],
      { width: 3, color: blue },
    );
    markers.vectorStroke(
      [
        { x: target.x, y: target.y - 8 },
        { x: target.x, y: target.y + 8 },
      ],
      { width: 3, color: blue },
    );
  }
  await save(
    output,
    "ik-reach",
    project,
    await comparison(output, "Can the hand reach the target?", [
      { label: "Reach the first cross", png: await renderFramePNG(project, 0) },
      { label: "Bend to reach a nearer cross", png: await renderFramePNG(project, 1) },
      { label: "Too far: the hand stops short", png: await renderFramePNG(project, 2) },
    ]),
  );
}
