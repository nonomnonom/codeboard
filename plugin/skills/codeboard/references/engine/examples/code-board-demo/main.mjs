import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StoryboardProject, renderFramePNG, renderFrameSheet, renderOnionSkin, exportMovie } from 'codeboard-studio';
import { acting } from './poses.mjs';
import { colors, drawClawd, ground, obstacle } from './art.mjs';

export function createDemo() {
  const project = StoryboardProject.create({ title: 'Clawd — walk, notice, hop', width: 1920, height: 1080, frameRate: 24, background: colors.bg, seed: 72 });
  project.transaction('Draw the performance', () => {
    const panel = project.addScene('The obstacle', 'street').addShot('One considered hop', 'hop')
      .addPanel({ id: 'performance', title: 'Walk, notice, hop, land', durationFrames: 192,
        action: 'Clawd notices a line, gathers weight, hops across, and settles.' });
    ground(panel, 100, 1810, 800);
    obstacle(panel, 1271, 800);
    const stage = panel.addGroup('Stage', { id: 'stage', transform: { x: -120, y: 800, scaleX: 1.3, scaleY: 1.3 } });
    const track = panel.addGroup('Clawd drawings', { id: 'clawd' }, stage.id);
    const drawings = new Map();
    for (const [name, pose] of acting.drawings) {
      drawings.set(name, drawClawd(panel, pose, { parent: track.id, name }).id);
    }
    project.production.setDrawingSequence(track.id, acting.exposures.map(({ frame, id }) => ({ frame, drawingId: drawings.get(id) })));
    for (const { frame, x, y } of acting.exposures) {
      project.production.addLayerKeyframe(track.id, frame, { transform: { x, y }, easing: 'hold' });
    }
  });
  return project;
}

export async function saveReview(project, directory) {
  await mkdir(directory, { recursive: true });
  await project.save(join(directory, 'clawd.cboard'), { overwrite: true });
  await writeFile(join(directory, 'frame.png'), await renderFramePNG(project, 142));
  await writeFile(join(directory, 'poses.png'), await renderFrameSheet(project, [4, 94, 124, 130, 142, 156, 164, 186], { columns: 4, thumbnailWidth: 420 }));
  await writeFile(join(directory, 'onion.png'), await renderOnionSkin(project, [
    { panelId: 'performance', frame: 128 },
    { panelId: 'performance', frame: 124, layerIds: ['clawd'], tint: '#69aeba', opacity: .28 },
    { panelId: 'performance', frame: 132, layerIds: ['clawd'], tint: '#e9b364', opacity: .28 },
  ]));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const project = createDemo();
  const output = resolve('clawd-output');
  await saveReview(project, output);
  if (process.argv.includes('--movie')) await exportMovie(project, join(output, 'clawd.mp4'));
  console.log(`Saved editable project and review images to ${output}`);
}
