import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile, unlink } from 'node:fs/promises';
import { dirname, join, relative, resolve, posix, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(plugin, '..');
const output = join(plugin, 'skills/codeboard/references/engine');
const check = process.argv.includes('--check');
assert.ok(process.argv.slice(2).every(arg => arg === '--check'), 'Usage: node plugin/scripts/sync-reference.mjs [--check]');
let previousFiles = {};
try { previousFiles = JSON.parse(await readFile(join(output, 'bundle.json'), 'utf8')).bundledHashes ?? {}; }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const pkg = JSON.parse(await readFile(join(repo, 'package.json'), 'utf8'));
const files = [];
async function collect(folder, predicate) {
  for (const entry of await readdir(join(repo, folder), { withFileTypes: true })) {
    const path = `${folder}/${entry.name}`;
    if (entry.isDirectory()) await collect(path, predicate);
    else if (predicate(path)) files.push(path);
  }
}
await collect('docs', path => path.endsWith('.md') || path === 'docs/meta.json');
await collect('examples/code-board-demo', path => /\.(mjs|md)$/.test(path));
files.push('examples/quickstart.mjs', 'LICENSE', 'NOTICE');
files.sort();
const included = new Set(files);
const sha256 = data => createHash('sha256').update(data).digest('hex');
const sourceHashes = {}, bundledHashes = {}, expected = new Map();
for (const path of files) {
  const source = Buffer.from((await readFile(join(repo, path), 'utf8')).replace(/\r\n/g, '\n'));
  sourceHashes[path] = sha256(source);
  let bytes = source;
  if (path.endsWith('.md')) {
    let text = source.toString('utf8').replace(/\r\n/g, '\n');
    text = text.replace(/(\[[^\]]*\]\()([^\s)]+)(\))/g, (all, before, target, after) => {
      if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(target)) return all;
      const [local, fragment] = target.split('#');
      const resolved = posix.normalize(posix.join(posix.dirname(path), local));
      if (included.has(resolved)) return all;
      const url = resolved.startsWith('website/public/')
        ? `https://codeboard.nonom.xyz/${resolved.slice('website/public/'.length)}`
        : `https://github.com/nonomnonom/codeboard/blob/v${pkg.version}/${resolved}`;
      return `${before}${url}${fragment ? `#${fragment}` : ''}${after}`;
    });
    bytes = Buffer.from(text);
  }
  bundledHashes[path] = sha256(bytes);
  expected.set(path, bytes);
}
expected.set('bundle.json', Buffer.from(JSON.stringify({
  engine: pkg.name, engineVersion: pkg.version,
  source: 'https://github.com/nonomnonom/codeboard',
  hashEncoding: 'UTF-8 with LF line endings',
  contents: 'Canonical text documentation, quickstart, and standalone character example. Showcase images/videos and external installers are online links, not runtime dependencies.',
  sourceHashes, bundledHashes,
}, null, 2) + '\n'));

// Remove only obsolete files recorded by the previous bundle, never unknown files.
for (const path of Object.keys(previousFiles)) {
  if (expected.has(path)) continue;
  const destination = resolve(output, path);
  assert.ok(destination.startsWith(output + sep), 'Previous reference target escapes bundle');
  if (check) throw new Error(`Obsolete bundled reference: ${path}; run npm run docs:generate`);
  try { await unlink(destination); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
for (const [path, bytes] of expected) {
  const destination = resolve(output, path);
  assert.ok(!relative(output, destination).startsWith('..'), 'Reference target escapes bundle');
  if (check) {
    assert.deepEqual(await readFile(destination), bytes, `Stale bundled reference: ${path}; run npm run docs:generate`);
  } else {
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
  }
}
async function checkUnexpected(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) await checkUnexpected(path);
    else assert.ok(expected.has(relative(output, path).replaceAll('\\', '/')), `Unexpected file in generated reference bundle: ${path}`);
  }
}
await checkUnexpected(output);
console.log(`${check ? 'PASS' : 'Synced'}: ${files.length} bundled source files for Codeboard ${pkg.version}`);
