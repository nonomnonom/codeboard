import { renderShotFramePNG, type LayerSkinInput } from "codeboard-studio";
import { make, rect, amber, blue, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Share a bend between two joints");
  const panel = project.addScene("Skin").addShot("Weighted strip").addPanel({ durationFrames: 25 });
  const root = panel.addGroup("Fixed joint");
  const tip = panel.addGroup("Moving joint");
  const art = panel.addVectorLayer("Strip");
  for (let column = 0; column < 6; column++)
    rect(art, 60 + column * 40, 140, 40, 60, column % 2 ? blue : amber);
  project.production.addLayerKeyframe(tip.id, 0, { transform: { y: 0 }, easing: "linear" });
  project.production.addLayerKeyframe(tip.id, 24, { transform: { y: -80 } });
  const capture = project.capturePanelAnimation(panel.id, { id: "animation:skin-weights" });
  const id = (source: string) => {
    const identity = capture.identities.find((entry) => entry.sourceId === source);
    if (!identity) throw new Error(`Missing captured skin layer: ${source}`);
    return identity.capturedId;
  };
  const skin: LayerSkinInput = {
    source: [
      { x: 60, y: 140 },
      { x: 180, y: 140 },
      { x: 300, y: 140 },
      { x: 60, y: 200 },
      { x: 180, y: 200 },
      { x: 300, y: 200 },
    ],
    triangles: [
      [0, 1, 4],
      [0, 4, 3],
      [1, 2, 5],
      [1, 5, 4],
    ],
    joints: [
      { id: "root", bind: [1, 0, 0, 1, 0, 0] },
      { id: "tip", bind: [1, 0, 0, 1, 0, 0] },
    ],
    weights: [0, 0.5, 1, 0, 0.5, 1].map((weight) =>
      weight === 0
        ? [{ jointId: "root", weight: 1 }]
        : weight === 1
          ? [{ jointId: "tip", weight: 1 }]
          : [
              { jointId: "root", weight: 0.5 },
              { jointId: "tip", weight: 0.5 },
            ],
    ),
    jointLayers: [
      { jointId: "root", layerId: id(root.id) },
      { jointId: "tip", layerId: id(tip.id) },
    ],
  };
  project.editShotAnimation("animation:skin-weights", [
    { op: "layer.skin", layerId: id(art.id), skin },
  ]);
  const samples = [];
  for (const [frame, label] of [
    [0, "Rest: both joints at their bind positions"],
    [12, "Moving joint lifts the right side"],
    [24, "Left stays fixed; middle shares both influences"],
  ] as const)
    samples.push({
      label,
      png: await renderShotFramePNG(project.shotAnimation("animation:skin-weights"), frame),
    });
  await save(
    output,
    "skin-weights",
    project,
    await comparison(output, "Share a bend between two joints", samples),
  );
}
