import type { LayerHandle } from "codeboard-studio";
import { StoryboardProject, pathCommands } from "codeboard-studio";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.ts";
export const { paper, ink, amber, blue } = config;
export const make = (title: string, width = config.width, height = config.height) =>
  StoryboardProject.create({
    title,
    width,
    height,
    frameRate: config.frameRate,
    background: paper,
  });
export const rect = (
  layer: LayerHandle,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
) =>
  layer.path(pathCommands(`M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`), {
    fill,
  });
export const text = (layer: LayerHandle, value: string, x: number, y: number, size = 20) =>
  layer.text(value, x, y, { font: `${size}px sans-serif`, color: ink });
export async function save(output: string, name: string, project: StoryboardProject, png: Buffer) {
  await project.save(join(output, `${name}.cboard`));
  await writeFile(join(output, `${name}.png`), png);
}
