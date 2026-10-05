import { afterEach, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-static-export-"));
  directories.push(directory);
  return directory;
}

function normalize(directory: string) {
  return spawnSync(process.execPath, [resolve("scripts/normalize-website-export.mjs"), directory], {
    encoding: "utf8",
    windowsHide: true,
  });
}

it("normalizes Windows segment directories to browser URLs and accepts flat exports unchanged", async () => {
  const directory = await fixture();
  const route = join(directory, "docs/projects");
  const nested = join(route, "__next.docs", "!encoded");
  await mkdir(nested, { recursive: true });
  await writeFile(join(nested, "__PAGE__.txt"), "page payload");
  await writeFile(join(route, "__next._tree.txt"), "tree payload");
  await writeFile(join(route, "index.html"), "page html");
  const result = normalize(directory);
  expect(result.status).toBe(0);
  expect((await readdir(route)).sort()).toEqual([
    "__next._tree.txt",
    "__next.docs.!encoded.__PAGE__.txt",
    "index.html",
  ]);
  expect(await readFile(join(route, "__next.docs.!encoded.__PAGE__.txt"), "utf8")).toBe(
    "page payload",
  );
  expect(await readFile(join(route, "__next._tree.txt"), "utf8")).toBe("tree payload");
  expect(await readFile(join(route, "index.html"), "utf8")).toBe("page html");
  expect(normalize(directory).status).toBe(0);
});

it("fails without overwriting a colliding segment or deleting its source", async () => {
  const directory = await fixture();
  const nested = join(directory, "__next.docs");
  await mkdir(nested);
  await writeFile(join(nested, "__PAGE__.txt"), "source");
  await writeFile(join(directory, "__next.docs.__PAGE__.txt"), "existing");
  expect(normalize(directory).status).not.toBe(0);
  expect(await readFile(join(nested, "__PAGE__.txt"), "utf8")).toBe("source");
  expect(await readFile(join(directory, "__next.docs.__PAGE__.txt"), "utf8")).toBe("existing");
});
