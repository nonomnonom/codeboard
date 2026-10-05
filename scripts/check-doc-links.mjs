import { readdir, readFile, access } from "node:fs/promises";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const excluded = new Set([
  "node_modules",
  ".git",
  "dist",
  ".preview",
  "tmp",
  "output",
  "coverage",
  ".next",
  ".source",
  "out",
]);
async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (
      excluded.has(entry.name) ||
      (entry.name === "release" && resolve(directory) === resolve(root))
    )
      continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(path)));
    else if (entry.name.endsWith(".md")) files.push(path);
  }
  return files;
}
const files = await markdownFiles(root);
const errors = [];
async function checkNavigation(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const pages = entries.filter(
    (entry) => entry.isDirectory() || (entry.name.endsWith(".md") && entry.name !== "README.md"),
  );
  const publicPages = pages.filter((entry) => entry.name !== "media");
  const meta = JSON.parse(await readFile(resolve(directory, "meta.json"), "utf8"));
  const named = meta.pages.filter((name) => !name.startsWith("---"));
  const expected = publicPages.map((entry) =>
    entry.isDirectory() ? entry.name : entry.name.slice(0, -3),
  );
  for (const name of expected)
    if (!named.includes(name))
      errors.push(`${relative(root, directory)}: page missing from navigation: ${name}`);
  for (const name of named)
    if (!expected.includes(name))
      errors.push(`${relative(root, directory)}: navigation target missing: ${name}`);
  if (new Set(named).size !== named.length)
    errors.push(`${relative(root, directory)}: duplicate navigation entry`);
  for (const entry of publicPages)
    if (entry.isDirectory()) await checkNavigation(resolve(directory, entry.name));
}
await checkNavigation(resolve(root, "docs"));
let checked = 0;
for (const file of files) {
  const source = (await readFile(file, "utf8")).replace(/```[\s\S]*?```/g, "");
  for (const match of source.matchAll(/\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const link = match[1].replace(/^<|>$/g, "");
    if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(link)) continue;
    const path = decodeURIComponent(link.split(/[?#]/)[0]);
    if (!path) continue;
    const sourcePath = relative(root, file).replaceAll("\\", "/");
    const targetPath = relative(root, resolve(dirname(file), path)).replaceAll("\\", "/");
    if (
      sourcePath.startsWith("docs/") &&
      !sourcePath.startsWith("docs/media/") &&
      targetPath.startsWith("examples/")
    )
      errors.push(
        `${sourcePath}: framework guide links to example-owned content: ${link}; document the public operation or keep the walkthrough with its example`,
      );
    checked++;
    try {
      await access(resolve(dirname(file), path));
    } catch {
      errors.push(`${relative(root, file)}: ${link}`);
    }
  }
}
if (errors.length) {
  console.error(`Documentation errors:\n${errors.join("\n")}`);
  process.exitCode = 1;
} else
  console.log(
    `Checked ${checked} local link targets in ${files.length} Markdown files (external URLs and anchors are not checked).`,
  );
