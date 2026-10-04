export const starter = `import { StoryboardProject, brushes, catmullRom, renderFramePNG } from 'codeboard-studio';
import { mkdir, writeFile } from 'node:fs/promises';

const project = StoryboardProject.create({
  title: 'First stroke', width: 960, height: 540, frameRate: 24,
  background: '#f3eddf',
});
const panel = project.addScene('Scene').addShot('A rising mark')
  .addPanel({ id: 'first', durationFrames: 48 });
panel.addRasterLayer('Ink', { id: 'ink' }).rasterStroke(catmullRom([
  { x: 150, y: 390, pressure: .2, time: 0 },
  { x: 360, y: 230, pressure: 1, time: 260 },
  { x: 600, y: 300, pressure: .8, time: 520 },
  { x: 800, y: 140, pressure: .12, time: 800 },
], 32), { ...brushes.cleanInk, size: 44 }, { color: '#191916', seed: 12 });

await mkdir('output', { recursive: true });
// This script owns these generated files. Keep later revisions in separate files.
await project.save('output/first.cboard', { overwrite: true });
await writeFile('output/first.png', await renderFramePNG(project, 0));
console.log('Created output/first.cboard and output/first.png');
`;
