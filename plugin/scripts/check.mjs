import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, resolve, join, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFile(join(root, path), "utf8");
const json = async (path) => JSON.parse(await read(path));
const portable = await json("plugin.json");
for (const file of [".codex-plugin/plugin.json", ".claude-plugin/plugin.json"]) {
  const manifest = await json(file);
  for (const key of ["name", "version", "description"])
    assert.equal(manifest[key], portable[key], `${file}: ${key}`);
}
assert.match(portable.name, /^[a-z0-9-]+$/);
assert.match(portable.version, /^\d+\.\d+\.\d+$/);
assert.equal((await json(".codex-plugin/plugin.json")).skills, "./skills/");
for (const file of [".agents/plugins/marketplace.json", ".claude-plugin/marketplace.json"]) {
  const catalog = await json(file);
  assert.equal(catalog.plugins.length, 1);
  assert.equal(catalog.plugins[0].name, portable.name);
  assert.equal(
    typeof catalog.plugins[0].source === "string"
      ? catalog.plugins[0].source
      : catalog.plugins[0].source.path,
    "./",
  );
}
const skillDirs = await readdir(join(root, "skills"));
assert.ok(skillDirs.length);
const paragraphs = new Map();
const docTargets = new Set();
for (const name of skillDirs) {
  const content = (await read(`skills/${name}/SKILL.md`)).replace(/\r\n/g, "\n");
  assert.ok(
    content.startsWith(`---\nname: ${name}\ndescription: `),
    `Invalid skill frontmatter: ${name}`,
  );
  assert.ok(!content.includes("../"), `${name}: refer to other skills by name, not relative path`);
  assert.match(content, /\ndescription: Use when /, `${name}: description must state a trigger`);
  const description = content.match(/\ndescription: (.+)\n/)[1];
  assert.ok(description.length <= 500, `${name}: discovery description is too long`);
  assert.ok(
    content.split(/\s+/).length <= 550,
    `${name}: split reference material out of the entrypoint`,
  );
  for (const paragraph of content.split(/\n\s*\n/).map((value) => value.trim())) {
    if (paragraph.length < 160) continue;
    assert.ok(
      !paragraphs.has(paragraph),
      `${name}: repeats a paragraph owned by ${paragraphs.get(paragraph)}`,
    );
    paragraphs.set(paragraph, name);
  }
  for (const match of content.matchAll(/\bcodeboard-[a-z-]+\b/g)) {
    if (["codeboard-studio", "codeboard-demo"].includes(match[0])) continue;
    assert.ok(skillDirs.includes(match[0]), `${name}: unknown skill ${match[0]}`);
  }
  for (const match of content.matchAll(/`(docs\/[a-z0-9-]+\.md)`/g)) {
    await stat(resolve(root, "skills/codeboard/references/engine", match[1]));
    docTargets.add(match[1]);
  }
}
async function checkLinks(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await checkLinks(path);
    else if (entry.name.endsWith(".md")) {
      const content = await readFile(path, "utf8");
      for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const target = match[1].split("#")[0];
        if (!target || /^https?:/.test(target)) continue;
        const absolute = resolve(dirname(path), target);
        const local = relative(root, absolute);
        assert.ok(!local.startsWith("..") && !isAbsolute(local), `Link escapes plugin: ${target}`);
        await stat(absolute);
      }
    }
  }
}
await checkLinks(root);
console.log(
  `PASS: manifests, catalogs, ${skillDirs.length} skills, named dependencies, local references, ${docTargets.size} engine doc targets`,
);
