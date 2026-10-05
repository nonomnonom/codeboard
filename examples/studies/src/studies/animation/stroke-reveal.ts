import { brushes, catmullRom, renderFramePNG } from "codeboard-studio";
import { make, ink, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Watch a line draw itself");
  const panel = project.addScene("Reveal").addShot("One stroke").addPanel({ durationFrames: 25 });
  panel.addRasterLayer("Revealed ink").rasterStroke(
    catmullRom(
      [
        { x: 40, y: 190, pressure: 0.3 },
        { x: 140, y: 65, pressure: 1 },
        { x: 235, y: 185, pressure: 0.6 },
        { x: 320, y: 80, pressure: 0.2 },
      ],
      32,
    ),
    { ...brushes.cleanInk, size: 14 },
    { color: ink, seed: 11, reveal: { startFrame: 0, endFrame: 24 } },
  );
  const samples = [];
  for (const frame of [0, 8, 16, 24])
    samples.push({
      label:
        frame === 0
          ? "Start: no paint revealed yet"
          : frame === 24
            ? "End: the full stroke"
            : `Frame ${frame}: part of the same stroke`,
      png: await renderFramePNG(project, frame),
    });
  await save(
    output,
    "stroke-reveal",
    project,
    await comparison(output, "Watch a line draw itself", samples, 2),
  );
}
