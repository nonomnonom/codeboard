import {
  StoryboardProject,
  exportMovie,
  exportStoryboard,
  renderContactSheet,
  renderDetail,
  renderPanelPNG,
} from "codeboard-studio";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { output } from "../config.ts";
export async function render(
  board: StoryboardProject,
  output: string,
  movie = false,
): Promise<void> {
  console.log("Rendering storyboard");
  await writeFile(
    join(output, "hand-detail.png"),
    await renderDetail(board, "panel:06", { x: 280, y: 190, width: 570, height: 340 }),
  );
  const exported = await exportStoryboard(board, output, { columns: 2, rows: 2 });
  const closingPanel = board.toJSON().panels.find((p) => p.id === "panel:14")!;
  await writeFile(
    join(output, "hero.png"),
    await renderPanelPNG(board, closingPanel.id, {
      annotations: false,
      frame: closingPanel.startFrame + 48,
    }),
  );
  await writeFile(join(output, "contact-sheet.png"), await renderContactSheet(board));
  await writeFile(
    join(output, "manifest.json"),
    JSON.stringify(
      {
        panels: board.toJSON().panels.map((panel) => panel.id),
        frames: board.production.summary().durationFrames,
        seconds: board.production.summary().durationFrames / board.toJSON().frameRate,
        files: exported,
      },
      null,
      2,
    ),
  );
  if (movie) {
    const stats = await exportMovie(board, join(output, "last-light.mp4"), {
      assetRoot: output,
      onProgress: (n, total) => {
        if (n % 24 === 0) console.log(`Movie ${n}/${total}`);
      },
    });
    await writeFile(
      join(output, "render-metrics.json"),
      JSON.stringify({ ...stats, node: process.version, memory: process.memoryUsage() }, null, 2),
    );
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some((arg) => arg !== "--movie"))
    throw new Error("Usage: render.ts [--movie]");
  await render(
    await StoryboardProject.open(join(output, "last-light.cboard")),
    output,
    process.argv.includes("--movie"),
  );
}
