import { readFile, writeFile, readdir } from 'node:fs/promises';
import { zipSync } from 'fflate';
const root = new URL('../', import.meta.url);
const target = new URL('website/public/art/code-board-demo/', root);
const small = {};
for (const name of ['main.mjs','revise.mjs','art.mjs','poses.mjs','README.md'])
  small[`code-board-demo/${name}`] = await readFile(new URL(`examples/code-board-demo/${name}`, root));
small['code-board-demo/LICENSE'] = await readFile(new URL('LICENSE', root));
await writeFile(new URL('source.zip',target), zipSync(small,{level:9}));
const full = {};
async function collect(relative) {
  for(const entry of await readdir(new URL(relative,root),{withFileTypes:true})) {
    if(entry.name === 'audio') continue; // Local selected-score experiments are not distribution inputs.
    const name = `${relative}${entry.name}`;
    if(entry.isDirectory()) await collect(`${name}/`);
    else if(entry.name.endsWith('.ts')) full[name] = await readFile(new URL(name,root));
  }
}
await collect('code-board-demo/src/');
full['code-board-demo/README.md'] = await readFile(new URL('code-board-demo/README.md',root));
full['code-board-demo/LICENSE'] = small['code-board-demo/LICENSE'];
await writeFile(new URL('launch-source.zip',target),zipSync(full,{level:9}));
console.log('Packaged standalone performance and complete launch source.');
