import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const api = await import(pathToFileURL(join(repo, 'dist/src/index.js')));
const { StoryboardProject, createToneWav, pathCommands, renderFramePNG, evaluateDrawing,
  createPixels, fillPixels, encodePixels, ProjectStore } = api;
const cases = JSON.parse(await readFile(join(here, 'cases.json'), 'utf8'));
const [mode, location, caseId] = process.argv.slice(2);
assert.ok(location && ['prepare', 'grade'].includes(mode), 'Usage: node plugin/evals/run.mjs prepare <temporary parent> | grade <run directory> [case ID]');
assert.ok(!caseId || (mode === 'grade' && cases.some(item => item.id === caseId)), 'Unknown case ID or case selection outside grade');

function u32(n) { const bytes = Buffer.alloc(4); bytes.writeUInt32BE(n); return bytes; }
function crc(data) {
  let n = 0xffffffff;
  for (const v of data) { n ^= v; for (let i = 0; i < 8; i++) n = (n >>> 1) ^ ((n & 1) ? 0xedb88320 : 0); }
  return (n ^ 0xffffffff) >>> 0;
}
async function fixture(folder) {
  const p = StoryboardProject.create({ title: 'Operation fixture', width: 320, height: 180, frameRate: 24 });
  const scene = p.addScene('Scene', 'scene');
  scene.addShot('Lead', 'lead-shot').addPanel({ id: 'lead', title: 'Lead', durationFrames: 24 });
  const shot = scene.addShot('Performance', 'performance-shot');
  const panel = shot.addPanel({ id: 'performance', title: 'Performance', durationFrames: 24 });
  scene.addShot('Tail', 'tail-shot').addPanel({ id: 'tail', title: 'Tail', durationFrames: 24 });
  const track = panel.addGroup('Drawings', { id: 'drawings' });
  for (const [id, name, x, color] of [['rest', 'Rest', 60, '#226644'], ['reach', 'Reach', 120, '#aa4433']]) {
    const drawing = panel.addGroup(name, { id }, track.id);
    panel.addVectorLayer(`${name} ink`, { id: `${id}-ink` }, drawing.id)
      .path(pathCommands(`M ${x} 60 L ${x + 40} 60 L ${x + 40} 100 L ${x} 100 Z`), { id: `${id}-shape`, fill: color });
  }
  panel.addVectorLayer('Ground', { id: 'ground' }).path(pathCommands('M 20 130 L 300 130'), { id: 'ground-line', stroke: '#333333', strokeWidth: 2 });
  p.production.setDrawingSequence(track.id, [{ frame: 24, drawingId: 'rest' }, { frame: 32, drawingId: 'reach' }, { frame: 40, drawingId: 'rest' }]);
  p.production.addLayerKeyframe(track.id, 24, { transform: { x: 0 }, easing: 'hold' });
  p.production.addLayerKeyframe(track.id, 40, { transform: { x: 8 }, easing: 'hold' });
  for (const [frame, x, zoom] of [[24, 0, 1], [36, 12, 1.1], [47, 20, 1.2]]) {
    p.production.addCameraKeyframe(shot.id, frame, { x, y: 4, zoom, rotation: .02 });
  }
  await writeFile(join(folder, 'tone.wav'), createToneWav({ durationSeconds: 4, volume: .05 }));
  const asset = p.production.addAsset({ id: 'tone', kind: 'audio', name: 'Tone', path: 'tone.wav', mimeType: 'audio/wav', source: 'linked' });
  const audio = p.production.addAudioTrack('Sound', { id: 'sound' });
  for (const [id, name, startFrame, durationFrames] of [['hit', 'Hit', 44, 4], ['tail-cue', 'Tail cue', 48, 6], ['ambience', 'Ambience', 0, 72]]) {
    p.production.addAudioClip(audio, { id, name, assetId: asset, startFrame, sourceInFrame: 2, durationFrames, volume: .4, fadeInFrames: 0, fadeOutFrames: 0 });
  }
  await p.save(join(folder, 'film.cboard'), { assetRoot: folder });
  await writeFile(join(folder, 'original.png'), await renderFramePNG(p, 34));
  return p.toJSON();
}

if (mode === 'prepare') {
  const parent = resolve(location);
  await mkdir(parent, { recursive: true });
  const run = await mkdtemp(join(parent, 'run-'));
  const truth = {};
  for (const c of cases) {
    const folder = join(run, c.id);
    await mkdir(folder);
    if (c.id !== 'brush') truth[c.id] = await fixture(folder);
    else {
      const pixels = createPixels(3, 3); fillPixels(pixels, [255, 0, 0, 255]);
      const png = await encodePixels(pixels);
      const xml = '<Preset name="Eval reed" paintopid="paintbrush"><param name="brush_definition"><![CDATA[<Brush filename="tip.gbr" spacing="0.3"/>]]></param><param name="OpacityValue">0.7</param><param name="UntranslatedSensor">curve</param></Preset>';
      const data = Buffer.from(`preset\0${xml}`), body = Buffer.concat([Buffer.from('tEXt'), data]);
      await writeFile(join(folder, 'reed.kpp'), Buffer.concat([png.subarray(0, -12), u32(data.length), body, u32(crc(body)), png.subarray(-12)]));
      await writeFile(join(folder, 'tip.gbr'), Buffer.concat([u32(32), u32(2), u32(3), u32(2), u32(1), Buffer.from('GIMP'), u32(25), Buffer.from('tip\0'), Buffer.from([0, 90, 0, 255, 128, 0])]));
    }
    const prompt = `${c.request}\n\nEngine checkout: ${repo}\nCLI: node "${join(repo, 'dist/src/cli.js')}"\nWork only in: ${folder}\nRead the engine documentation as needed. Do not modify the engine, plugin, evaluator, or sibling task directories. Do not read truth.json or evaluator implementation. No commits, installs, network services, or other agents. Record commands, failures, and observed results in actions.md. Report unavailable checks honestly.\n`;
    await writeFile(join(folder, 'task.md'), prompt);
  }
  await writeFile(join(run, 'truth.json'), JSON.stringify(truth));
  const hashes = {};
  for (const folder of ['docs', 'plugin/skills']) {
    for (const name of await readdir(join(repo, folder))) {
      const path = folder === 'docs' ? join(folder, name) : join(folder, name, 'SKILL.md');
      if (!path.endsWith('.md')) continue;
      hashes[path] = createHash('sha256').update(await readFile(join(repo, path))).digest('hex');
    }
  }
  await writeFile(join(run, 'environment.json'), JSON.stringify({
    engineVersion: JSON.parse(await readFile(join(repo, 'package.json'), 'utf8')).version,
    node: process.version, platform: process.platform, arch: process.arch,
    createdAt: new Date().toISOString(), hashes,
  }, null, 2));
  console.log(run);
} else {
  const run = resolve(location), truth = JSON.parse(await readFile(join(run, 'truth.json'), 'utf8'));
  const results = [];
  for (const c of cases.filter(item => !caseId || item.id === caseId)) {
    const folder = join(run, c.id);
    try {
      const png = async name => assert.equal((await readFile(join(folder, name))).subarray(0, 8).toString('hex'), '89504e470d0a1a0a', name);
      const file = join(folder, c.id === 'brush' ? 'study.cboard' : 'film.cboard');
      const store = ProjectStore.open(file); try { store.verify(); } finally { store.close(); }
      const p = await StoryboardProject.open(file), doc = p.toJSON();
      if (c.id === 'hold') {
        const old = truth.hold, seq = p.production.drawingSequence('drawings').keys;
        const original = old.panels[1].layers[0].drawingSequence;
        for (let frame = 24; frame < 48; frame++) assert.equal(evaluateDrawing(seq, frame), frame >= 30 && frame < 36 ? 'rest' : evaluateDrawing(original, frame), `drawing frame ${frame}`);
        const panels = structuredClone(doc.panels);
        panels[1].layers[0].drawingSequence = old.panels[1].layers[0].drawingSequence;
        for (const panel of panels) panel.revision = old.panels.find(item => item.id === panel.id).revision;
        assert.deepEqual(panels, old.panels, 'unrelated panel/artwork changed');
        assert.deepEqual(doc.shots, old.shots); assert.deepEqual(doc.audioTracks, old.audioTracks);
        await png('before.png'); await png('after.png');
        assert.deepEqual(await readFile(join(folder, 'before.png')), await renderFramePNG(StoryboardProject.fromJSON(old), 34), 'before frame does not match input');
        assert.deepEqual(await readFile(join(folder, 'after.png')), await renderFramePNG(p, 34), 'after frame does not match saved state');
      } else if (c.id === 'retime') {
        const old = truth.retime;
        assert.equal(doc.panels[1].durationFrames, 36); assert.equal(doc.panels[2].startFrame, 60);
        assert.equal(p.production.audioClip('hit').startFrame, 56); assert.equal(p.production.audioClip('tail-cue').startFrame, 60);
        assert.deepEqual(p.production.audioClip('ambience'), { ...old.audioTracks[0].clips[2], trackId: 'sound' });
        for (const id of ['hit', 'tail-cue']) {
          const before = old.audioTracks[0].clips.find(clip => clip.id === id), after = p.production.audioClip(id);
          for (const key of ['sourceInFrame', 'durationFrames', 'volume', 'assetId']) assert.equal(after[key], before[key], `${id}.${key}`);
        }
        const key = p.production.cameraKeyframes('performance-shot', { limit: 20 }).find(key => key.frame === 42);
        assert.ok(key); assert.equal(key.zoom, 1.4); assert.equal(key.x, 12); assert.equal(key.y, 4); assert.equal(key.rotation, .02);
        for (const id of ['rest-shape', 'reach-shape', 'ground-line']) {
          const beforeProject = StoryboardProject.fromJSON(old);
          assert.deepEqual(p.production.element(id), beforeProject.production.element(id), `artwork ${id}`);
        }
        await png('before.png'); await png('after.png');
        assert.deepEqual(await readFile(join(folder, 'before.png')), await renderFramePNG(StoryboardProject.fromJSON(old), 36), 'before midpoint');
        assert.deepEqual(await readFile(join(folder, 'after.png')), await renderFramePNG(p, 42), 'after midpoint');
      } else {
        const report = JSON.parse(await readFile(join(folder, 'import.json'), 'utf8'));
        const missing = JSON.parse(await readFile(join(folder, 'missing.json'), 'utf8'));
        assert.equal(report.resources.length, 1); assert.equal(report.missingDependencies.length, 0);
        assert.ok(report.unsupported.some(value => value.includes('UntranslatedSensor')));
        assert.equal(missing.resources.length, 0); assert.ok(missing.missingDependencies.includes('tip.gbr'));
        const [stroke] = p.production.find({ kind: 'raster-stroke', limit: 20 }); assert.ok(stroke);
        const brush = p.production.element(stroke.id).brush;
        assert.equal(brush.tip.kind, 'bitmap'); assert.equal(brush.tip.width, 3); assert.equal(brush.tip.height, 2);
        assert.deepEqual(brush.tip.alpha, [0, 90 / 255, 0, 1, 128 / 255, 0]);
        await png('swatch.png');
      }
      assert.ok((await readFile(join(folder, 'result.md'), 'utf8')).trim());
      assert.ok((await readdir(folder)).some(name => /\.(mjs|mts|ts|js)$/.test(name)), 'missing authoring source');
      results.push({ id: c.id, status: 'pass' });
    } catch (error) { results.push({ id: c.id, status: 'fail', error: error.message }); }
  }
  await writeFile(join(run, caseId ? `grade-${caseId}.json` : 'grade.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  if (results.some(result => result.status === 'fail')) process.exitCode = 1;
}
