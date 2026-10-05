import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

export const config = {
  title: "Studio timing study",
  width: 320,
  height: 180,
  frameRate: 24,
  sourceFrames: 132,
  cutFrames: 120,
  sequenceId: "timing-edit",
  output: resolve(
    process.env.CODEBOARD_EXAMPLE_OUTPUT ?? fileURLToPath(new URL("../output/", import.meta.url)),
  ),
} as const;

export function paths(directory = config.output) {
  return {
    directory,
    project: join(directory, "timing.cboard"),
    plan: join(directory, "revision-plan.json"),
    receipt: join(directory, "revision-receipt.json"),
    movie: join(directory, "timing.mp4"),
  };
}
