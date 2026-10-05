import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export const output = resolve(
  process.env.CODEBOARD_EXAMPLE_OUTPUT ?? fileURLToPath(new URL("../output/", import.meta.url)),
);
export const config = {
  title: "First stroke",
  width: 960,
  height: 540,
  frameRate: 24,
  background: "#f3eddf",
  durationFrames: 48,
  reviewFrame: 47,
};
