import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export const output = resolve(
  process.env.CODEBOARD_EXAMPLE_OUTPUT ?? fileURLToPath(new URL("../output/", import.meta.url)),
);
export const config = {
  title: "Clawd / walk, notice, hop",
  width: 1920,
  height: 1080,
  frameRate: 24,
  seed: 72,
  durationFrames: 192,
};
export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const presentation = resolve(process.env.CODEBOARD_DEMO_OUTPUT ?? `${output}/presentation`);
export const paths = {
  root: projectRoot,
  output: presentation,
  performance: `${presentation}/performance`,
  launch: `${presentation}/launch`,
};
