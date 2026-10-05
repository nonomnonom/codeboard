import { StoryboardProject, renderFramePNG } from "codeboard-studio";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { config, output } from "../config.ts";
const args = process.argv.slice(2);
if (args.length > 1 || args[0]?.startsWith("--"))
  throw new Error("Usage: render.ts [output-directory]");
const directory = resolve(args[0] ?? output);
const project = await StoryboardProject.open(join(directory, "first-stroke.cboard"));
await writeFile(
  join(directory, "first-stroke.png"),
  await renderFramePNG(project, config.reviewFrame),
);
