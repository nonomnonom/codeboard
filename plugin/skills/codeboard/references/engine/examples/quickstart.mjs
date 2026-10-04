import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { StoryboardProject, brushes, catmullRom, renderFramePNG } from 'codeboard-studio';

const output = resolve(process.argv[2] ?? 'examples/output/quickstart');
await mkdir(output, { recursive: true });
const project = StoryboardProject.create({
  title: 'First stroke', width: 960, height: 540, frameRate: 24, background: '#f3eddf',
});
const panel = project.addScene('A mark').addShot('Close-up').addPanel({
  id: 'first-stroke', durationFrames: 48,
});
project.transaction('Draw a rising brush stroke', () => {
  panel.addRasterLayer('Ink').rasterStroke(catmullRom([
    { x: 150, y: 390, pressure: .2, time: 0 },
    { x: 360, y: 230, pressure: 1, time: 260 },
    { x: 600, y: 300, pressure: .8, time: 520 },
    { x: 800, y: 140, pressure: .12, time: 800 },
  ], 32), { ...brushes.cleanInk, size: 44 }, {
    color: '#191916', seed: 12, reveal: { startFrame: 0, endFrame: 36 },
  });
});
await project.save(join(output, 'first-stroke.cboard'), { overwrite: true });
await writeFile(join(output, 'first-stroke.png'), await renderFramePNG(project, 47));
console.log(`Created ${join(output, 'first-stroke.cboard')} and first-stroke.png`);
