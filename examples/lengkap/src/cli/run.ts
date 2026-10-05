import { StoryboardProject } from "codeboard-studio";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { author } from "../project/author.ts";
import { output } from "../config.ts";
import { attachSound } from "../audio/attach.ts";
import { render } from "../review/render.ts";
export { author } from "../project/author.ts";
async function main() {
  if (process.argv.slice(2).some((arg) => arg !== "--movie"))
    throw new Error("Usage: run.ts [--movie]");
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output);
  const board = author();
  await attachSound(board, output);
  const file = join(output, "lengkap.cboard");
  await board.save(file);
  await render(await StoryboardProject.open(file), process.argv.includes("--movie"));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
