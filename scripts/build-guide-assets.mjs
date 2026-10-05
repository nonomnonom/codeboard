import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { starter } from '../dist/src/starter.js';
import { ProjectStore } from '../dist/src/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const work = join(root, '.preview', 'documentation-assets');
const target = join(root, 'website', 'public', 'art', 'guides');
await mkdir(work, { recursive: true });
await mkdir(target, { recursive: true });
function run(args) {
  const result = spawnSync(process.execPath, [join(root, 'dist/src/cli.js'), ...args], { cwd: work, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Guide asset generation failed: ${result.status}`);
}
const studies = ['representations', 'clipping', 'selections', 'components', 'drawing-timing', 'ik-reach', 'audio-placement', 'hierarchy'];
run(['run', join(root, 'examples/documentation.mjs'), work]);
for (const name of studies) {
  const store = ProjectStore.open(join(work, `${name}.cboard`));
  try { store.verify(); } finally { store.close(); }
  await copyFile(join(work, `${name}.png`), join(target, `${name}.png`));
}
await writeFile(join(work, 'quickstart.mjs'), starter);
run(['run', join(work, 'quickstart.mjs')]);
await copyFile(join(work, 'output/first.png'), join(target, 'quickstart.png'));
await copyFile(join(root, 'examples/documentation.mjs'), join(target, 'documentation.mjs'));
console.log('Generated nine guide illustrations, validated study projects, and copied runnable source.');
