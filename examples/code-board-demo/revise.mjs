import { writeFile } from 'node:fs/promises';
import { StoryboardProject, renderFramePNG } from 'codeboard-studio';

const project = await StoryboardProject.open('clawd-output/clawd.cboard');
const frame = 124;
await writeFile('clawd-output/before.png', await renderFramePNG(project, 128));
const before = project.version;
project.transaction('Hold the anticipation for two more frames', () => {
  const { current } = project.production.drawingNeighbors('clawd', frame);
  if (!current?.drawingId) throw new Error('Anticipation drawing is missing');
  project.production.setDrawingRange('clawd', 126, 130, current.drawingId);
});
await writeFile('clawd-output/after.png', await renderFramePNG(project, 128));
console.log(project.production.changesSince(before, { limit: 10 }));
await project.save('clawd-output/clawd.cboard');
