import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
import { createDemo, saveReview } from '../examples/code-board-demo/main.mjs';
import { StoryboardProject, brushes, customizeBrush, renderBrushSwatch, renderFramePNG, renderContactSheet, renderDetail } from 'codeboard-studio';
import { at, drawing } from '../examples/code-board-demo/poses.mjs';
import { colors, drawClawd, ground } from '../examples/code-board-demo/art.mjs';

const directory = new URL('../website/public/art/code-board-demo/', import.meta.url);
await mkdir(directory, { recursive: true });
const project = createDemo();
await saveReview(project, fileURLToPath(directory));
await writeFile(new URL('camera-wide.png', directory), await renderFramePNG(project, 128));
const cameraKey = project.production.addCameraKeyframe('hop', 128, { x: 60, y: 160, zoom: 2, rotation: 0 });
await writeFile(new URL('camera-close.png', directory), await renderFramePNG(project, 128));
project.production.removeCameraKeyframe('hop', cameraKey);
const crop = { x: 760, y: 420, width: 620, height: 450 };
await writeFile(new URL('before.png', directory), await renderDetail(project, 'performance', crop, 128));
const { current } = project.production.drawingNeighbors('clawd', 124);
project.production.setDrawingRange('clawd', 126, 130, current.drawingId);
await writeFile(new URL('after.png', directory), await renderDetail(project, 'performance', crop, 128));
const study = StoryboardProject.create({ title: 'Performance drawings', width: 560, height: 440, background: colors.bg });
const shot = study.addScene('Pose study').addShot('Weight and gesture');
for (const [frame, title] of [[4, 'Walk'], [94, 'Notice'], [124, 'Anticipation'], [130, 'Push'], [142, 'Flight'], [156, 'Landing'], [164, 'Recovery'], [186, 'Settle']]) {
  const panel = shot.addPanel({ title: `${title} / f${frame}`, durationFrames: 1 });
  ground(panel, 30, 530, 350);
  drawClawd(panel, drawing(at(frame).id), { x: 280, y: 350 + at(frame).y * .5, scale: 1.3 });
}
await writeFile(new URL('key-drawings.png', directory), await renderContactSheet(study, { columns: 4, thumbnailWidth: 360 }));
for (const [name, brush] of Object.entries({ pencil: brushes.roughPencil, ink: brushes.cleanInk, dry: customizeBrush(brushes.charcoal, { texture: 'dry-brush', textureStrength: .75 }) })) {
  await writeFile(new URL(`brush-${name}.png`, directory), await renderBrushSwatch(brush));
}
const files = {};
for (const name of ['main.mjs', 'revise.mjs', 'art.mjs', 'poses.mjs', 'README.md']) {
  files[`code-board-demo/${name}`] = await readFile(new URL(`../examples/code-board-demo/${name}`, import.meta.url));
}
files['code-board-demo/LICENSE'] = await readFile(new URL('../LICENSE', import.meta.url));
await writeFile(new URL('source.zip', directory), zipSync(files, { level: 9 }));
console.log('Rendered Codeboard walkthrough, revision comparison, brush swatches and source archive.');
