import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createPixels,
  encodePixels,
  importBrushResource,
  brushFromResource,
  brushes,
  renderFramePNG,
} from "codeboard-studio";
import { make, ink, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const pixels = createPixels(32, 32);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const index = (y * 32 + x) * 4;
      pixels.pixels[index + 3] = Math.abs(x - 15.5) + Math.abs(y - 15.5) < 14 ? 255 : 0;
    }
  const path = join(output, "authored-diamond.png");
  await writeFile(path, await encodePixels(pixels));
  const imported = await importBrushResource(path, {
    maskMode: "alpha",
    origin: { source: "Diamond authored in this study", license: "MIT", redistribution: "allowed" },
  });
  const tip = imported.resources.find((resource) => resource.role === "tip");
  if (!tip) throw new Error("The authored PNG did not produce a brush tip");
  const project = make("Use an imported shape as a brush tip");
  const shot = project.addScene("Brush resource").addShot("Same tip, different spacing");
  const samples = [];
  for (const [spacing, label] of [
    [0.2, "Close spacing joins the diamond stamps"],
    [1.2, "Wide spacing reveals the imported diamond"],
  ] as const) {
    const brush = brushFromResource(tip, {
      ...brushes.cleanInk,
      id: `diamond:${spacing}`,
      name: "Authored diamond",
      size: 48,
      spacing,
      taperStart: 0,
      taperEnd: 0,
    });
    shot
      .addPanel({ durationFrames: 1 })
      .addRasterLayer("Stroke")
      .rasterStroke(
        [
          { x: 40, y: 140, pressure: 1 },
          { x: 320, y: 140, pressure: 1 },
        ],
        brush,
        { color: ink, seed: 3 },
      );
    samples.push({ label, png: await renderFramePNG(project, samples.length) });
  }
  await save(
    output,
    "brush-import",
    project,
    await comparison(output, "Use an imported shape as a brush tip", samples),
  );
}
