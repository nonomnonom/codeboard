import { renderFramePNG } from "codeboard-studio";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { author } from "../project/author.ts";
import { config, output as defaultOutput } from "../config.ts";
export async function main(output: string): Promise<void> {
  await mkdir(output, { recursive: true });
  const project = author();
  await project.save(join(output, "first-stroke.cboard"), { overwrite: true });
  await writeFile(
    join(output, "first-stroke.png"),
    await renderFramePNG(project, config.reviewFrame),
  );
  console.log(`Created ${join(output, "first-stroke.cboard")} and first-stroke.png`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(resolve(process.argv[2] ?? defaultOutput));
}
