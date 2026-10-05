import { StoryboardProject, renderFramePNG } from "codeboard-studio";
import { writeFile } from "node:fs/promises";
import { output } from "../config.ts";
const project = await StoryboardProject.open(`${output}/clawd.cboard`);
const frame = 124;
await writeFile(`${output}/before.png`, await renderFramePNG(project, 128));
const before = project.version;
project.transaction("Hold the anticipation for two more frames", () => {
  const { current } = project.production.drawingNeighbors("clawd", frame);
  if (!current?.drawingId) throw new Error("Anticipation drawing is missing");
  project.production.setDrawingRange("clawd", 126, 130, current.drawingId);
});
await writeFile(`${output}/after.png`, await renderFramePNG(project, 128));
console.log(project.production.changesSince(before, { limit: 10 }));
await project.save(`${output}/clawd.cboard`);
