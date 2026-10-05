import { StoryboardProject } from "codeboard-studio";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { author } from "../project/author.ts";
import { output } from "../config.ts";
import { render } from "../review/render.ts";
if (process.argv.slice(2).some((arg) => arg !== "--movie"))
  throw new Error("Usage: run.ts [--movie]");
await mkdir(dirname(output), { recursive: true });
await mkdir(output);
const project = await author(output);
await project.save(join(output, "last-light.cboard"));
await render(
  await StoryboardProject.open(join(output, "last-light.cboard")),
  output,
  process.argv.includes("--movie"),
);
console.log(`Created editable project and review files in ${output}; visual review is pending.`);
