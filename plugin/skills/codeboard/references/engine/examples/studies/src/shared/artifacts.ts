import { decodePixels, renderFramePNG } from "codeboard-studio";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { make, text } from "../shared.ts";

export async function report(output: string, name: string, value: unknown): Promise<void> {
  await writeFile(join(output, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
}

export async function sheet(
  title: string,
  samples: { label: string; png: Buffer }[],
  columns = 3,
): Promise<Buffer> {
  const images = await Promise.all(samples.map((sample) => decodePixels(sample.png)));
  const first = images[0];
  if (!first) throw new Error("A study sheet requires samples");
  const width = 360,
    height = Math.round((width * first.height) / first.width),
    gap = 16;
  const project = make(
    title,
    columns * (width + gap) + gap,
    Math.ceil(samples.length / columns) * (height + 48) + gap,
  );
  project.configure({ canvas: { background: "#e8e0cd" } });
  const panel = project.addScene("Rendered samples").addShot(title).addPanel({ durationFrames: 1 });
  const labels = panel.addVectorLayer("Sample labels");
  for (const [index, sample] of samples.entries()) {
    const image = images[index]!,
      x = gap + (index % columns) * (width + gap),
      y = gap + Math.floor(index / columns) * (height + 48);
    panel
      .addRasterLayer(`Sample ${index + 1}`, {
        transform: { x, y, scaleX: width / image.width, scaleY: height / image.height },
      })
      .rasterSurface(image);
    text(labels, sample.label, x, y + height + 26, 16);
  }
  return renderFramePNG(project, 0);
}
