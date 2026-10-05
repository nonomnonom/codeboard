import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export const output = resolve(
  process.env.CODEBOARD_EXAMPLE_OUTPUT ?? fileURLToPath(new URL("../output/", import.meta.url)),
);
export const config = {
  width: 360,
  height: 280,
  frameRate: 24,
  paper: "#f3eddf",
  ink: "#252820",
  amber: "#b77528",
  blue: "#397783",
};
