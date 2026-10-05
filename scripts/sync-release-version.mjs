import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const write = (path, content) => writeFile(new URL(path, root), content);
const { version } = JSON.parse(await read('package.json'));

for (const path of ['plugin/plugin.json', 'plugin/.codex-plugin/plugin.json', 'plugin/.claude-plugin/plugin.json']) {
  const manifest = JSON.parse(await read(path));
  manifest.version = version;
  await write(path, JSON.stringify(manifest, null, 2) + '\n');
}
const website = await read('website/lib/shared.ts');
await write('website/lib/shared.ts', website.replace(/export const releaseVersion = '[^']+';/, `export const releaseVersion = '${version}';`));
const pluginReadme = await read('plugin/README.md');
await write('plugin/README.md', pluginReadme
  .replace(/referensi API Codeboard [\d.]+/, `referensi API Codeboard ${version}`)
  .replace(/Versi plugin: \*\*[^*]+\*\*/, `Versi plugin: **${version}**`));
console.log(`Synchronized release metadata to ${version}`);
