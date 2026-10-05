import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import {
  StoryboardProject, brushes, catmullRom, pathCommands, renderFramePNG,
  renderContactSheet, renderFrameSheet, createPixels, fillPixels,
  polygonPixelSelection, featherPixelSelection,
} from 'codeboard-studio';

const output = resolve(process.argv[2] ?? 'output/documentation');
await mkdir(output, { recursive: true });
const paper = '#f3eddf', ink = '#252820', amber = '#b77528', blue = '#397783';
const make = (title, width = 360, height = 280) => StoryboardProject.create({ title, width, height, frameRate: 24, background: paper });
const rect = (layer, x, y, w, h, fill) => layer.path(pathCommands(`M ${x} ${y} L ${x+w} ${y} L ${x+w} ${y+h} L ${x} ${y+h} Z`), { fill });
const text = (layer, value, x, y, size = 20) => layer.text(value, x, y, { font: `${size}px sans-serif`, color: ink });
async function save(name, project, png) {
  await project.save(join(output, `${name}.cboard`), { overwrite: true });
  await writeFile(join(output, `${name}.png`), png);
}

// Each study owns its named output files; keep independently revised projects elsewhere.
{
  const project = make('Editable representations');
  const shot = project.addScene('Study').addShot('Three representations');
  const path = catmullRom([{ x: 45, y: 205, pressure: .15 }, { x: 140, y: 70, pressure: 1 }, { x: 300, y: 150, pressure: .2 }], 32);
  shot.addPanel({ title: 'Replayable brush', durationFrames: 1 }).addRasterLayer('Paint')
    .rasterStroke(path, { ...brushes.charcoal, size: 34 }, { color: ink, seed: 17 });
  shot.addPanel({ title: 'Vector stroke', durationFrames: 1 }).addVectorLayer('Contour')
    .vectorStroke(path, { width: 34, color: ink });
  const panel = shot.addPanel({ title: 'Pixel surface', durationFrames: 1 });
  const pixels = createPixels(32, 24);
  fillPixels(pixels, [183, 117, 40, 255], { selection: polygonPixelSelection(32, 24, [{ x: 3, y: 21 }, { x: 14, y: 3 }, { x: 29, y: 18 }]) });
  panel.addRasterLayer('Pixels').rasterSurface(pixels, { matrix: [8, 0, 0, 8, 52, 40] });
  await save('representations', project, await renderContactSheet(project, { columns: 3, thumbnailWidth: 360 }));
}

{
  const project = make('Clipping comparison');
  const shot = project.addScene('Study').addShot('Sibling alpha');
  for (const [title, clipped] of [['Silhouette only', null], ['Unclipped highlight', false], ['Clipped highlight', true]]) {
    const panel = shot.addPanel({ title, durationFrames: 1 });
    const base = panel.addVectorLayer('Silhouette');
    base.path(pathCommands('M 70 230 L 95 75 Q 180 15 265 75 L 290 230 Z'), { fill: amber });
    if (clipped !== null) {
      const highlight = panel.addVectorLayer('Highlight', { clipToBelow: clipped });
      rect(highlight, 30, 100, 300, 42, '#f7ce7f');
      rect(highlight, 30, 166, 300, 24, '#f7ce7f');
    }
  }
  await save('clipping', project, await renderContactSheet(project, { columns: 3, thumbnailWidth: 360 }));
}

{
  const project = make('Pixel selections');
  const shot = project.addScene('Study').addShot('Source resolution');
  for (const [title, feather] of [['Hard selection', 0], ['Feather: sigma 8 px', 8]]) {
    const panel = shot.addPanel({ title, durationFrames: 1 });
    const image = createPixels(256, 220);
    let selection = polygonPixelSelection(256, 220, [{ x: 20, y: 190 }, { x: 128, y: 20 }, { x: 236, y: 190 }]);
    if (feather) selection = await featherPixelSelection(selection, feather);
    fillPixels(image, [183, 117, 40, 255], { selection });
    panel.addRasterLayer('Selection').rasterSurface(image, { matrix: [1, 0, 0, 1, 52, 30] });
  }
  await save('selections', project, await renderContactSheet(project, { columns: 2, thumbnailWidth: 480 }));
}

{
  const project = make('Static components', 900, 360);
  const panel = project.addScene('Study').addShot('Repeated prop').addPanel({ durationFrames: 1 });
  const source = panel.addGroup('Lamp source');
  const art = panel.addVectorLayer('Lamp geometry', {}, source.id);
  rect(art, 0, 0, 12, 130, ink);
  art.path(pathCommands('M -40 0 L -25 -45 L 37 -45 L 52 0 Z'), { fill: amber });
  rect(art, -25, 130, 62, 10, ink);
  const component = project.production.captureComponent(source.id, 'Lamp');
  source.set({ visible: false });
  for (const [x, scale] of [[150, 1], [410, .7], [675, 1.3]]) {
    project.production.instantiateComponent(component, panel.id, { x, y: 110, scaleX: scale, scaleY: scale });
  }
  const labels = panel.addVectorLayer('Labels');
  text(labels, '1.0x', 132, 318); text(labels, '0.7x', 392, 318); text(labels, '1.3x', 657, 318);
  await save('components', project, await renderFramePNG(project, 0));
}

{
  const project = make('Drawing changes and placement');
  const panel = project.addScene('Study').addShot('Two poses').addPanel({ durationFrames: 24 });
  const track = panel.addGroup('Drawing track');
  const a = panel.addVectorLayer('Triangle', {}, track.id);
  a.path(pathCommands('M -30 35 L 0 -40 L 30 35 Z'), { fill: amber });
  const b = panel.addVectorLayer('Diamond', {}, track.id);
  b.path(pathCommands('M -38 0 L 0 -45 L 38 0 L 0 45 Z'), { fill: blue });
  project.production.setDrawingSequence(track.id, [{ frame: 0, drawingId: a.id }, { frame: 12, drawingId: b.id }]);
  project.production.addLayerKeyframe(track.id, 0, { transform: { x: 65, y: 140 }, easing: 'linear' });
  project.production.addLayerKeyframe(track.id, 23, { transform: { x: 295, y: 140 } });
  await save('drawing-timing', project, await renderFrameSheet(project, [0, 5, 11, 12, 18, 23], { columns: 3, thumbnailWidth: 360 }));
}

{
  const project = make('Two-bone reach');
  const shot = project.addScene('Study').addShot('Reach limits');
  for (const [index, target] of [[0, { x: 230, y: 120 }], [1, { x: 190, y: 80 }], [2, { x: 330, y: 110 }]]) {
    const panel = shot.addPanel({ title: index === 2 ? 'Outside reach' : `Reach ${index + 1}`, durationFrames: 1 });
    const root = panel.addGroup('Shoulder', { transform: { x: 90, y: 180 } });
    const elbow = panel.addGroup('Elbow', { transform: { x: 100, y: 0 } }, root.id);
    panel.addVectorLayer('Upper arm', {}, root.id).vectorStroke([{ x: 0, y: 0 }, { x: 100, y: 0 }], { width: 18, color: ink });
    panel.addVectorLayer('Forearm', {}, elbow.id).vectorStroke([{ x: 0, y: 0 }, { x: 80, y: 0 }], { width: 14, color: amber });
    project.production.setTwoBoneRig(root.id, { elbowId: elbow.id, upperLength: 100, lowerLength: 80 });
    const result = project.production.poseTwoBoneRig(root.id, index, target, { bend: 1, easing: 'hold' });
    if (result.reachable !== (index !== 2)) throw new Error('Unexpected reach result');
    const markers = panel.addVectorLayer('Target');
    markers.vectorStroke([{ x: target.x - 8, y: target.y }, { x: target.x + 8, y: target.y }], { width: 3, color: blue });
    markers.vectorStroke([{ x: target.x, y: target.y - 8 }, { x: target.x, y: target.y + 8 }], { width: 3, color: blue });
  }
  await save('ik-reach', project, await renderContactSheet(project, { columns: 3, thumbnailWidth: 360 }));
}

{
  const project = make('Audio placement diagram', 960, 400);
  const panel = project.addScene('Diagram').addShot('Source and timeline').addPanel({ durationFrames: 1 });
  const layer = panel.addVectorLayer('Diagram');
  text(layer, 'Audio placement at 24 fps', 40, 45, 26);
  text(layer, 'Source', 40, 114); text(layer, 'Project', 40, 264);
  for (let second = 0; second <= 6; second++) {
    const x = 180 + second * 110;
    rect(layer, x, 130, 1, 20, ink); rect(layer, x, 280, 1, 20, ink);
    text(layer, `${second}s`, x - 9, 172, 16); text(layer, `${second}s`, x - 9, 322, 16);
  }
  rect(layer, 180, 90, 660, 40, '#d8cebb');
  rect(layer, 290, 90, 330, 40, amber);
  rect(layer, 400, 240, 330, 40, amber);
  text(layer, 'Read source 1–4s', 320, 78, 18);
  text(layer, 'Play at project 2–5s', 414, 226, 18);
  text(layer, 'sourceInFrame: 24     startFrame: 48     durationFrames: 72', 180, 375, 18);
  await save('audio-placement', project, await renderFramePNG(project, 0));
}
{
  const project = make('Project hierarchy diagram', 960, 500);
  const panel = project.addScene('Diagram').addShot('Ownership').addPanel({ durationFrames: 1 });
  const layer = panel.addVectorLayer('Diagram');
  text(layer, 'From a project to editable artwork', 40, 48, 28);
  const entries = [
    ['Project', 'Canvas defaults, frame rate, assets'],
    ['Sequence / scene', 'Organize the story'],
    ['Shot', 'Ordered panels and camera keys'],
    ['Panel', 'Duration, captions and artwork'],
    ['Group / layer', 'Hierarchy, placement and composition'],
    ['Element', 'Stroke, contour, text or pixel surface'],
  ];
  entries.forEach(([name, description], i) => {
    const x = 48 + i * 28, y = 108 + i * 65;
    if (i) layer.vectorStroke([{ x: x - 15, y: y - 42 }, { x: x - 15, y: y - 8 }, { x: x - 3, y: y - 8 }], { width: 2, color: amber });
    text(layer, name, x, y, 22); text(layer, description, 430, y, 19);
  });
  await save('hierarchy', project, await renderFramePNG(project, 0));
}
console.log(`Rendered eight documentation studies in ${output}`);
