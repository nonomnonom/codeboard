import { renderShotFramePNG, type ShotCompositeGraph } from "codeboard-studio";
import { motion } from "../../shared/motion.ts";
import { save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const { project } = motion("Separate a prop from its background");
  const animation = project.shotAnimation("animation:study");
  const prop = animation.layers.find((layer) => layer.name === "Moving prop");
  const ground = animation.layers.find((layer) => layer.name === "Ground");
  if (!prop || !ground) throw new Error("The captured shot must contain its prop and ground");
  const graph: ShotCompositeGraph = {
    nodes: [
      { id: "ground", kind: "source", layerIds: [ground.id] },
      { id: "prop", kind: "source", layerIds: [prop.id] },
      { id: "grade", kind: "effects", input: "prop", effects: [{ kind: "saturation", amount: 0 }] },
      {
        id: "picture",
        kind: "blend",
        background: "ground",
        foreground: "grade",
        mode: "source-over",
        opacity: 1,
      },
    ],
    output: "picture",
  };
  const samples = [
    {
      label: "Complete shot with its scene background",
      png: await renderShotFramePNG(animation, 12),
    },
    {
      label: "Prop only; the PNG outside it is transparent",
      png: await renderShotFramePNG(animation, 12, {
        layerIds: [prop.id],
        background: "transparent",
      }),
    },
    {
      label: "Grade the prop pass, then combine with ground",
      png: await renderShotFramePNG(animation, 12, { compositing: graph }),
    },
  ];
  project.editShotAnimation(animation.id, [{ op: "compositing.set", graph }]);
  await save(
    output,
    "render-passes",
    project,
    await comparison(output, "Separate a prop from its background", samples),
  );
}
