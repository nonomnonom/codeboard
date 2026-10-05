import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export const output = resolve(
  process.env.CODEBOARD_EXAMPLE_OUTPUT ?? fileURLToPath(new URL("../output/", import.meta.url)),
);
export const config = {
  id: "project:last-light",
  title: "THE LAST LIGHT / PENJAGA CAHAYA",
  width: 1280,
  height: 720,
  frameRate: 24,
  seed: 42,
};
