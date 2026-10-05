import { StoryboardProject, renderFramePNG } from "codeboard-studio";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { author } from "../project/author.ts";
import { config, output as defaultOutput } from "../config.ts";
export async function main(output: string): Promise<void> {
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output);
  const project = author();
  await project.save(join(output, "first-stroke.cboard"));
  await writeFile(
    join(output, "first-stroke.png"),
    await renderFramePNG(
      await StoryboardProject.open(join(output, "first-stroke.cboard")),
      config.reviewFrame,
    ),
  );
  console.log(`Created ${join(output, "first-stroke.cboard")} and first-stroke.png`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args[0]?.startsWith("--"))
    throw new Error("Usage: run.ts [new-output-directory]");
  await main(resolve(args[0] ?? defaultOutput));
}
