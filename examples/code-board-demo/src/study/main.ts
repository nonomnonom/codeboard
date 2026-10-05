import {
  StoryboardProject,
  exportMovie,
  renderFramePNG,
  renderFrameSheet,
  renderOnionSkin,
} from "codeboard-studio";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { colors, drawClawd, ground, obstacle } from "../character/art.ts";
import { config, output } from "../config.ts";
import { acting } from "../character/poses.ts";
export function createDemo() {
  const project = StoryboardProject.create({ ...config, background: colors.bg });
  project.transaction("Draw the performance", () => {
    const panel = project
      .addScene("The obstacle", "street")
      .addShot("One considered hop", "hop")
      .addPanel({
        id: "performance",
        title: "Walk, notice, hop, land",
        durationFrames: 192,
        action: "Clawd notices a line, gathers weight, hops across, and settles.",
      });
    ground(panel, 100, 1810, 800);
    obstacle(panel, 1271, 800);
    const stage = panel.addGroup("Stage", {
      id: "stage",
      transform: { x: -120, y: 800, scaleX: 1.3, scaleY: 1.3 },
    });
    const track = panel.addGroup("Clawd drawings", { id: "clawd" }, stage.id);
    const drawings = new Map<string, string>();
    for (const [name, pose] of acting.drawings) {
      drawings.set(name, drawClawd(panel, pose, { parent: track.id, name }).id);
    }
    project.production.setDrawingSequence(
      track.id,
      acting.exposures.map(({ frame, id }) => {
        const drawingId = drawings.get(id);
        if (!drawingId) throw new Error(`Unknown exposure drawing ${id}`);
        return { frame, drawingId };
      }),
    );
    for (const { frame, x, y } of acting.exposures) {
      project.production.addLayerKeyframe(track.id, frame, { transform: { x, y }, easing: "hold" });
    }
  });
  return project;
}
export async function saveReview(project: StoryboardProject, directory: string) {
  await mkdir(directory, { recursive: true });
  await project.save(join(directory, "clawd.cboard"), { overwrite: true });
  await renderReview(project, directory);
}
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
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const project = createDemo();
  await saveReview(project, output);
  if (process.argv.includes("--movie")) await exportMovie(project, join(output, "clawd.mp4"));
  console.log(`Saved editable project and review images to ${output}`);
}
