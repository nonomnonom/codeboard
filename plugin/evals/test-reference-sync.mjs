import assert from 'node:assert/strict';
import { access, cp, mkdir, mkdtemp, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const plugin = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const parent = resolve(plugin, '../.preview');
await mkdir(parent, { recursive: true });
const fixture = await mkdtemp(join(parent, 'reference-sync-'));
for (const path of ['docs', 'examples/code-board-demo', 'plugin/scripts']) {
  await mkdir(join(fixture, path), { recursive: true });
}
await cp(join(plugin, 'scripts/sync-reference.mjs'), join(fixture, 'plugin/scripts/sync-reference.mjs'));
for (const [path, text] of Object.entries({
  'package.json': JSON.stringify({ name: 'codeboard-studio', version: '0.2.1' }),
  'docs/index.md': '# Manual\n\n[Guide](guide.md)\n[Source](../examples/quickstart.mjs)\n![Media](../website/public/art/demo.png)\n',
  'docs/guide.md': '# Guide\n',
  'examples/quickstart.mjs': '// quickstart\n',
  'examples/documentation.mjs': '// documentation studies\n',
  'examples/code-board-demo/main.mjs': '// demo\n',
  'LICENSE': 'License\n', 'NOTICE': 'Notice\n',
})) await writeFile(join(fixture, path), text);
const bundle = join(fixture, 'plugin/skills/codeboard/references/engine');
function run(check = false, success = true) {
  const result = spawnSync(process.execPath, [join(fixture, 'plugin/scripts/sync-reference.mjs'), ...(check ? ['--check'] : [])], { encoding: 'utf8' });
  assert.equal(result.status === 0, success, result.error?.message ?? result.stderr);
  return result;
}
run(); run(true);
await writeFile(join(fixture, 'NOTICE'), 'Notice\r\n');
run(true);
const index = await readFile(join(bundle, 'docs/index.md'), 'utf8');
assert.ok(index.includes('[Guide](guide.md)') && index.includes('../examples/quickstart.mjs'));
assert.ok(index.includes('https://codeboard.nonom.xyz/art/demo.png'));
await writeFile(join(fixture, 'docs/guide.md'), '# Updated once\n');
run(true, false); run(); run(true);
assert.equal(await readFile(join(bundle, 'docs/guide.md'), 'utf8'), '# Updated once\n');
await writeFile(join(bundle, 'docs/guide.md'), '# Accidental manual edit\n');
run(true, false); run(); run(true);
await writeFile(join(fixture, 'docs/renamed.md'), '# Renamed\n');
await unlink(join(fixture, 'docs/guide.md'));
run(true, false); run(); run(true);
await assert.rejects(access(join(bundle, 'docs/guide.md')), { code: 'ENOENT' });
await access(join(bundle, 'docs/renamed.md'));
const metadataPath = join(bundle, 'bundle.json');
const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
metadata.bundledHashes['../../outside.md'] = 'invalid';
await writeFile(metadataPath, JSON.stringify(metadata));
assert.match(run(false, false).stderr, /escapes bundle/);
console.log('PASS: single-source updates, drift/tamper rejection, link rewriting, rename cleanup, and deletion boundary');
