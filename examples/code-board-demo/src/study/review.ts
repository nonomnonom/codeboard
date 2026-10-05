import {
  type StoryboardProject,
  renderFramePNG,
  renderFrameSheet,
  renderOnionSkin,
} from "codeboard-studio";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
export async function renderReview(project: StoryboardProject, directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "frame.png"), await renderFramePNG(project, 142));
  await writeFile(
    join(directory, "poses.png"),
    await renderFrameSheet(project, [4, 94, 124, 130, 142, 156, 164, 186], {
      columns: 4,
      thumbnailWidth: 420,
    }),
  );
  await writeFile(
    join(directory, "onion.png"),
    await renderOnionSkin(project, [
      { panelId: "performance", frame: 128 },
      { panelId: "performance", frame: 124, layerIds: ["clawd"], tint: "#69aeba", opacity: 0.28 },
      { panelId: "performance", frame: 132, layerIds: ["clawd"], tint: "#e9b364", opacity: 0.28 },
    ]),
  );
}
