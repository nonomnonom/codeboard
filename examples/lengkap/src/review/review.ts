import { createRenderSession, renderFrameSheet, type StoryboardProject } from "codeboard-studio";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config, output } from "../config.ts";
export async function sheets(board: StoryboardProject) {
  const session = createRenderSession(board),
    frames = config.reviewFrames;
  await writeFile(
    join(output, "lengkap-storyboard.png"),
    await renderFrameSheet(board, frames, { columns: 3, thumbnailWidth: 608 }),
  );
  await writeFile(join(output, "lengkap-hero.png"), await session.frame(359).toBuffer("png"));
}
