import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
assert.ok(process.argv[2], 'Usage: node plugin/evals/test-grader.mjs <passing run directory>');
const source = resolve(process.argv[2]);
function grade(folder, expectedStatus) {
  const result = spawnSync(process.execPath, [join(here, 'run.mjs'), 'grade', folder], { encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  assert.equal(result.status, expectedStatus, result.stdout + result.stderr);
}
grade(source, 0);
const parent = resolve(here, '../../.preview/codeboard-evals');
await mkdir(parent, { recursive: true });
const copy = await mkdtemp(join(parent, 'grader-negative-'));
await cp(source, copy, { recursive: true, errorOnExist: true, force: false });
const { StoryboardProject } = await import(pathToFileURL(resolve(here, '../../dist/src/index.js')));
const holdPath = join(copy, 'hold/film.cboard');
const hold = await StoryboardProject.open(holdPath);
hold.production.setDrawingRange('drawings', 30, 37, 'rest');
await hold.save(holdPath);
const retimePath = join(copy, 'retime/film.cboard');
const retime = await StoryboardProject.open(retimePath);
retime.production.updateAudioClip('sound', 'hit', { startFrame: 44 });
await retime.save(retimePath);
const report = JSON.parse(await readFile(join(copy, 'brush/import.json'), 'utf8'));
const missingPath = join(copy, 'brush/missing.json');
const missing = JSON.parse(await readFile(missingPath, 'utf8'));
missing.resources = report.resources;
await writeFile(missingPath, JSON.stringify(missing));
grade(copy, 1);
const results = JSON.parse(await readFile(join(copy, 'grade.json'), 'utf8'));
assert.equal(results.length, 3);
assert.ok(results.every(result => result.status === 'fail'));
console.log(`PASS: grader accepted real outputs and rejected an off-by-one hold, an unsynchronized cue, and a fabricated fallback tip.\nEvidence: ${copy}`);
