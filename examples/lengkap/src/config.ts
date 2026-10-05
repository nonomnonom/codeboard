import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export const output = resolve(
  process.env.CODEBOARD_EXAMPLE_OUTPUT ?? fileURLToPath(new URL("../output/", import.meta.url)),
);
export const config = {
  id: "project:lengkap",
  title: "LENGKAP",
  width: 1920,
  height: 1080,
  frameRate: 24,
  seed: 37,
  panelFrames: 60,
  reviewFrames: [59, 119, 179, 239, 299, 359],
};
