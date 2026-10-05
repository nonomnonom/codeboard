import { decodePixels, renderFramePNG } from "codeboard-studio";
import { mkdir, writeFile } from "node:fs/promises";
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
  columns = Math.min(columns, samples.length);
  const width = 360,
    height = Math.max(...images.map((image) => Math.round((width * image.height) / image.width))),
    gap = 24,
    heading = 88,
    caption = 84;
  const project = make(
    title,
    columns * (width + gap) + gap,
    Math.ceil(samples.length / columns) * (height + caption + gap) + heading,
  );
  project.configure({ canvas: { background: "#e8e0cd" } });
  const panel = project.addScene("Rendered samples").addShot(title).addPanel({ durationFrames: 1 });
  const labels = panel.addVectorLayer("Sample labels");
  text(labels, title, gap, 38, 24);
  text(labels, "Read the pictures in order", gap, 64, 16);
  for (const [index, sample] of samples.entries()) {
    const image = images[index]!,
      x = gap + (index % columns) * (width + gap),
      y = heading + Math.floor(index / columns) * (height + caption + gap);
    const scale = Math.min(width / image.width, height / image.height);
    panel
      .addRasterLayer(`Sample ${index + 1}`, {
        transform: { x: x + (width - image.width * scale) / 2, y, scaleX: scale, scaleY: scale },
      })
      .rasterSurface(image);
    const lines = wrap(`${index + 1}. ${sample.label}`, 36);
    for (const [line, value] of lines.entries())
      text(labels, value, x, y + height + 26 + line * 23, 18);
  }
  return renderFramePNG(project, 0);
}

function wrap(value: string, limit: number): string[] {
  const lines: string[] = [];
  for (const word of value.split(/\s+/)) {
    const last = lines.length - 1;
    if (last < 0 || lines[last]!.length + word.length + 1 > limit) lines.push(word);
    else lines[last] += ` ${word}`;
  }
  return lines;
}

export interface ComparisonFrame {
  label: string;
  image: string;
  width: number;
  height: number;
}

/** Retain individual full-size renders and captions alongside the documentation sheet. */
export async function comparison(
  output: string,
  title: string,
  samples: { label: string; png: Buffer }[],
  columns = 3,
): Promise<Buffer> {
  await mkdir(join(output, "steps"), { recursive: true });
  const frames: ComparisonFrame[] = [];
  for (const [index, sample] of samples.entries()) {
    const image = `steps/${index + 1}.png`;
    const pixels = await decodePixels(sample.png);
    await writeFile(join(output, image), sample.png);
    frames.push({ label: sample.label, image, width: pixels.width, height: pixels.height });
  }
  await report(output, "comparison", { title, columns: Math.min(columns, samples.length), frames });
  return sheet(title, samples, columns);
}
