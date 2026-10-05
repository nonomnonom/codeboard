import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const write = (path, content) => writeFile(new URL(path, root), content);
const { version } = JSON.parse(await read("package.json"));
const website = await read("website/lib/shared.ts");
const declaration = /export const releaseVersion = (["'])[^"']+\1;/g;
if ([...website.matchAll(declaration)].length !== 1)
  throw new Error("Expected exactly one website releaseVersion declaration");
const updatedWebsite = website.replace(
  declaration,
  `export const releaseVersion = ${JSON.stringify(version)};`,
);

for (const path of [
  "plugin/plugin.json",
  "plugin/.codex-plugin/plugin.json",
  "plugin/.claude-plugin/plugin.json",
]) {
  const source = await read(path);
  JSON.parse(source);
  await write(path, source.replace(/("version"\s*:\s*)"[^"]*"/, `$1${JSON.stringify(version)}`));
}
await write("website/lib/shared.ts", updatedWebsite);
const pluginReadme = await read("plugin/README.md");
await write(
  "plugin/README.md",
  pluginReadme
    .replace(/referensi API Codeboard [\d.]+/, `referensi API Codeboard ${version}`)
    .replace(/Versi plugin: \*\*[^*]+\*\*/, `Versi plugin: **${version}**`),
);
console.log(`Synchronized release metadata to ${version}`);
