import { readdir, readFile, access } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const excluded = new Set(['node_modules', '.git', 'dist', 'tmp', 'output', 'coverage', '.next', '.source', 'out', 'release']);
async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(path));
    else if (entry.name.endsWith('.md')) files.push(path);
  }
  return files;
}
const files = await markdownFiles(root);
const errors = [];
let checked = 0;
for (const file of files) {
  const source = (await readFile(file, 'utf8')).replace(/```[^]*?```/g, '');
  for (const match of source.matchAll(/\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const link = match[1].replace(/^<|>$/g, '');
    if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(link)) continue;
    const path = decodeURIComponent(link.split(/[?#]/)[0]);
    if (!path) continue;
    checked++;
    try { await access(resolve(dirname(file), path)); }
    catch { errors.push(`${relative(root, file)}: ${link}`); }
  }
}
if (errors.length) {
  console.error(`Broken local Markdown links:\n${errors.join('\n')}`);
  process.exitCode = 1;
} else console.log(`Checked ${checked} local link targets in ${files.length} Markdown files (external URLs and anchors are not checked).`);
