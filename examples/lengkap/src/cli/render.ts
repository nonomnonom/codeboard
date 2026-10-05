import { StoryboardProject } from "codeboard-studio";
import { join } from "node:path";
import { output } from "../config.ts";
import { render } from "../review/render.ts";
if (process.argv.slice(2).some((arg) => arg !== "--movie"))
  throw new Error("Usage: render.ts [--movie]");
await render(
  await StoryboardProject.open(join(output, "lengkap.cboard")),
  process.argv.includes("--movie"),
);
