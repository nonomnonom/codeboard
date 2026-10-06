import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { StoryboardProject, renderFramePNG } from "codeboard-studio";
import { amber, blue, ink, make, text } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Turn three solids");
  const panel = project
    .addScene("Solids")
    .addShot("A shared pivot")
    .addPanel({ durationFrames: 49 });
  panel.addVectorLayer("Editable 3D scene").scene3D({
    width: 360,
    height: 280,
    camera: { kind: "perspective", fov: 40, position: [3, 2.1, 6], target: [0, 0, 0] },
    lights: [
      { kind: "ambient", color: "#ffffff", intensity: 0.55 },
      {
        kind: "directional",
        color: "#ffffff",
        intensity: 0.9,
        position: [3, 5, 4],
        target: [0, 0, 0],
      },
    ],
    nodes: [
      {
        id: "turntable",
        kind: "group",
        keyframes: [
          { frame: 0, rotation: [0, 0, 0], easing: "linear" },
          { frame: 48, rotation: [0, Math.PI * 2, 0], easing: "linear" },
        ],
      },
      {
        id: "box",
        kind: "mesh",
        parentId: "turntable",
        geometry: "box",
        position: [0.65, -0.05, 0],
        scale: [0.9, 1.4, 0.6],
        material: { kind: "lambert", color: amber },
      },
      {
        id: "ring",
        kind: "mesh",
        parentId: "turntable",
        geometry: "torus",
        position: [-0.75, 0.1, 0],
        scale: [1.1, 1.1, 1.1],
        material: { kind: "lambert", color: blue },
      },
      {
        id: "sphere",
        kind: "mesh",
        parentId: "turntable",
        geometry: "sphere",
        position: [0.1, 1.15, 0],
        scale: [0.6, 0.6, 0.6],
        material: { kind: "lambert", color: ink },
      },
    ],
  });
  text(panel.addVectorLayer("2D title"), "Turn three solids", 20, 32, 20);
  const file = join(output, "scene-3d.cboard");
  await project.save(file);
  const reopened = await StoryboardProject.open(file);
  const png = await comparison(output, "One pivot turns all three shapes", [
    { label: "Start: the ring faces us", png: await renderFramePNG(reopened, 0) },
    { label: "One-third turn: watch the ring's edge", png: await renderFramePNG(reopened, 16) },
    { label: "Two-thirds turn: the box changes sides", png: await renderFramePNG(reopened, 32) },
  ]);
  await writeFile(join(output, "scene-3d.png"), png);
}
