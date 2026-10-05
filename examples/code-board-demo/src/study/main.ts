import { StoryboardProject, exportMovie } from "codeboard-studio";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { output } from "../config.ts";
import { createDemo } from "./author.ts";
import { renderReview } from "./review.ts";
export { createDemo } from "./author.ts";
export { renderReview } from "./review.ts";
export async function saveReview(project: StoryboardProject, directory: string) {
  await mkdir(directory, { recursive: true });
  const file = join(directory, "clawd.cboard");
  await project.save(file);
  const saved = await StoryboardProject.open(file);
  await renderReview(saved, directory);
  return saved;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some((arg) => arg !== "--movie"))
    throw new Error("Usage: main.ts [--movie]");
  const saved = await saveReview(createDemo(), output);
  if (process.argv.includes("--movie")) await exportMovie(saved, join(output, "clawd.mp4"));
  console.log(`Saved editable project and review images to ${output}`);
}
