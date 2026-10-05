import { exportMovie, type StoryboardProject } from "codeboard-studio";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { output } from "../config.ts";
import { sheets } from "./review.ts";
export async function render(board: StoryboardProject, movie = false): Promise<void> {
  await sheets(board);
  if (movie) {
    const stats = await exportMovie(board, join(output, "lengkap.mp4"));
    await writeFile(join(output, "render-metrics.json"), JSON.stringify(stats, null, 2));
  }
}
