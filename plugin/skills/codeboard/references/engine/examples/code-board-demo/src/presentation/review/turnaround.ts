import { StoryboardProject, renderDetail, renderFrameSheet } from "codeboard-studio";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { paths } from "../../config.ts";
const board = await StoryboardProject.open(join(paths.launch, "codeboard-launch.cboard"));
const frames = Array.from({ length: 16 }, (_, i) => 168 + (i === 0 ? 0 : 12 + (i * 2 - 1) * 2));
await writeFile(
  join(paths.launch, "turnaround-sheet.png"),
  await renderFrameSheet(board, frames, { columns: 4, thumbnailWidth: 400 }),
);
const panel = board.toJSON().panels.find((p) => p.startFrame === 168)!;
for (const frame of frames)
  await writeFile(
    join(paths.launch, "review", `turn-${frame}.png`),
    await renderDetail(board, panel.id, { x: 900, y: 330, width: 700, height: 490 }, frame),
  );
