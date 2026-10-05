import { renderShotFramePNG, type EnvelopeMeshPose } from "codeboard-studio";
import { make, rect, amber, blue, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Bend a surface from its boundary");
  const panel = project.addScene("Cloth").addShot("Envelope").addPanel({ durationFrames: 25 });
  const art = panel.addVectorLayer("Woven rectangle");
  for (let row = 0; row < 4; row++)
    for (let column = 0; column < 6; column++)
      rect(art, 60 + column * 40, 90 + row * 30, 40, 30, (row + column) % 2 ? blue : amber);
  const capture = project.capturePanelAnimation(panel.id, { id: "animation:envelope" });
  const layerId = capture.identities.find((identity) => identity.sourceId === art.id)?.capturedId;
  if (!layerId) throw new Error("Missing captured cloth");
  const edge = (x: number, y: number, endX: number, endY: number): EnvelopeMeshPose["top"] => [
    { x, y },
    { x: x + (endX - x) / 3, y: y + (endY - y) / 3 },
    { x: x + ((endX - x) * 2) / 3, y: y + ((endY - y) * 2) / 3 },
    { x: endX, y: endY },
  ];
  const rest: EnvelopeMeshPose = {
    top: edge(60, 90, 300, 90),
    bottom: edge(60, 210, 300, 210),
    left: edge(60, 90, 60, 210),
    right: edge(300, 90, 300, 210),
  };
  const pose: EnvelopeMeshPose = {
    ...rest,
    top: [
      { x: 60, y: 90 },
      { x: 140, y: 20 },
      { x: 220, y: 20 },
      { x: 300, y: 90 },
    ],
    bottom: [
      { x: 60, y: 210 },
      { x: 140, y: 140 },
      { x: 220, y: 140 },
      { x: 300, y: 210 },
    ],
  };
  project.editShotAnimation("animation:envelope", [
    {
      op: "layer.envelope",
      layerId,
      envelope: {
        rest,
        columns: 12,
        rows: 6,
        keyframes: [
          { frame: 0, pose: rest, easing: "linear" },
          { frame: 24, pose, easing: "linear" },
        ],
      },
    },
  ]);
  const samples = [];
  for (const [frame, label] of [
    [0, "Rest: straight boundary and grid"],
    [12, "Halfway: the interior follows the boundary"],
    [24, "Curved boundary bends the whole surface"],
  ] as const)
    samples.push({
      label,
      png: await renderShotFramePNG(project.shotAnimation("animation:envelope"), frame),
    });
  await save(
    output,
    "envelope",
    project,
    await comparison(output, "Bend a surface from its boundary", samples),
  );
}
