import { brushes, customizeBrush, catmullRom, renderFramePNG } from "codeboard-studio";
import { make, ink, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Let pressure shape the stroke");
  const shot = project.addScene("Brush input").addShot("Same gesture");
  const points = catmullRom(
    [
      { x: 35, y: 185, pressure: 0.15 },
      { x: 160, y: 85, pressure: 1 },
      { x: 320, y: 175, pressure: 0.15 },
    ],
    32,
  );
  const samples = [];
  for (const [label, dynamics, spacing] of [
    ["Even width: pressure response off", { pressureSize: 0, pressureOpacity: 0 }, 0.1],
    ["Pressure makes the middle thicker", { pressureSize: 1, pressureOpacity: 0 }, 0.1],
    ["Wide spacing exposes individual stamps", { pressureSize: 1, pressureOpacity: 0 }, 0.9],
  ] as const) {
    const brush = customizeBrush(brushes.cleanInk, {
      size: 42,
      dynamics,
      spacing,
      taperStart: 0,
      taperEnd: 0,
    });
    shot
      .addPanel({ durationFrames: 1 })
      .addRasterLayer("Stroke")
      .rasterStroke(points, brush, { color: ink, seed: 7 });
    samples.push({ label, png: await renderFramePNG(project, samples.length) });
  }
  await save(
    output,
    "brush-dynamics",
    project,
    await comparison(output, "Let pressure shape the stroke", samples),
  );
}
