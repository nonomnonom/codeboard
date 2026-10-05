import { readdir } from "node:fs/promises";
import { join } from "node:path";

export async function documentationFiles(root) {
  const files = [];
  async function walk(folder) {
    for (const entry of await readdir(join(root, folder), { withFileTypes: true })) {
      const path = `${folder}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (
        entry.isFile() &&
        ((path.endsWith(".md") && entry.name !== "README.md") || entry.name === "meta.json")
      )
        files.push(path);
    }
  }
  await walk("docs");
  return files.sort();
}
