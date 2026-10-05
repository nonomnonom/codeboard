import { constants } from "node:fs";
import { copyFile, readdir, rmdir, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const output = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL("../website/out/", import.meta.url));
let normalized = 0;

// Next's exporter uses path.relative(), but its segment filename encoder only
// replaces forward slashes. Windows therefore emits directories instead of dots.
async function flatten(directory, destination, prefix) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const source = join(directory, entry.name);
    const name = `${prefix}.${entry.name}`;
    if (entry.isDirectory()) await flatten(source, destination, name);
    else if (entry.isFile() && entry.name.endsWith(".txt")) {
      await copyFile(source, join(destination, name), constants.COPYFILE_EXCL);
      await unlink(source);
      normalized++;
    } else throw new Error(`Unexpected Next segment export entry: ${source}`);
  }
  await rmdir(directory);
}

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "_next") continue;
    const child = join(directory, entry.name);
    if (entry.name.startsWith("__next.")) await flatten(child, directory, entry.name);
    else await visit(child);
  }
}

await visit(output);
console.log(`Normalized ${normalized} static router segment paths.`);
