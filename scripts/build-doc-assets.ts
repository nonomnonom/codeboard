import { copyFile, mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createDemo, saveReview } from "../examples/code-board-demo/src/study/main.ts";
import {
  StoryboardProject,
  brushes,
  customizeBrush,
  renderBrushSwatch,
  renderFramePNG,
  renderContactSheet,
  renderDetail,
} from "codeboard-studio";
import { at, drawing } from "../examples/code-board-demo/src/character/poses.ts";
import { colors, drawClawd, ground } from "../examples/code-board-demo/src/character/art.ts";

const published = new URL("../website/public/art/code-board-demo/", import.meta.url);
const stagingRoot = new URL("../.preview/documentation-assets/", import.meta.url);
await mkdir(stagingRoot, { recursive: true });
const staging = await mkdtemp(join(fileURLToPath(stagingRoot), "demo-"));
const directory = pathToFileURL(`${staging}/`);
const project = createDemo();
await saveReview(project, fileURLToPath(directory));
await writeFile(new URL("camera-wide.png", directory), await renderFramePNG(project, 128));
const cameraKey = project.production.addCameraKeyframe("hop", 128, {
  x: 60,
  y: 160,
  zoom: 2,
  rotation: 0,
});
await writeFile(new URL("camera-close.png", directory), await renderFramePNG(project, 128));
project.production.removeCameraKeyframe("hop", cameraKey);
const crop = { x: 760, y: 420, width: 620, height: 450 };
await writeFile(
  new URL("before.png", directory),
  await renderDetail(project, "performance", crop, 128),
);
const { current } = project.production.drawingNeighbors("clawd", 124);
if (!current) throw new Error("Expected a current Clawd drawing at frame 124");
project.production.setDrawingRange("clawd", 126, 130, current.drawingId);
await writeFile(
  new URL("after.png", directory),
  await renderDetail(project, "performance", crop, 128),
);
const study = StoryboardProject.create({
  title: "Performance drawings",
  width: 560,
  height: 440,
  background: colors.bg,
});
const shot = study.addScene("Pose study").addShot("Weight and gesture");
for (const [frame, title] of [
  [4, "Walk"],
  [94, "Notice"],
  [124, "Anticipation"],
  [130, "Push"],
  [142, "Flight"],
  [156, "Landing"],
  [164, "Recovery"],
  [186, "Settle"],
] as const) {
  const panel = shot.addPanel({ title: `${title} / f${frame}`, durationFrames: 1 });
  ground(panel, 30, 530, 350);
  drawClawd(panel, drawing(at(frame).id), { x: 280, y: 350 + at(frame).y * 0.5, scale: 1.3 });
}
await writeFile(
  new URL("key-drawings.png", directory),
  await renderContactSheet(study, { columns: 4, thumbnailWidth: 360 }),
);
for (const [name, brush] of Object.entries({
  pencil: brushes.roughPencil,
  ink: brushes.cleanInk,
  dry: customizeBrush(brushes.charcoal, { texture: "dry-brush", textureStrength: 0.75 }),
})) {
  await writeFile(new URL(`brush-${name}.png`, directory), await renderBrushSwatch(brush));
}
await mkdir(published, { recursive: true });
for (const name of await readdir(directory))
  await copyFile(new URL(name, directory), new URL(name, published));
console.log(`Rendered walkthrough, revision comparison and brush swatches. Source: ${staging}`);
