import { afterEach, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectStore, StoryboardProject } from "../../../src/index.js";

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function fixture(assetPath: string) {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-extraction-"));
  directories.push(directory);
  const project = StoryboardProject.create({ title: "Extraction" });
  project.production.addAsset({
    id: "audio",
    name: "Audio",
    kind: "audio",
    path: assetPath,
    mimeType: "audio/wav",
    source: "managed",
  });
  const source = join(directory, "source.cboard");
  const bytes = Buffer.from("embedded audio");
  using store = ProjectStore.create(source);
  store.save(project.toJSON(), { readAsset: () => bytes });
  return { directory, source, bytes, output: join(directory, "output") };
}

it("extracts dot-prefixed directories and preserves existing files", async () => {
  const { source, output, bytes } = await fixture("..media/audio.wav");
  using store = ProjectStore.open(source);
  store.extractAssets(output);
  const file = join(output, "..media/audio.wav");
  expect(await readFile(file)).toEqual(bytes);
  expect(() => store.extractAssets(output)).not.toThrow();
  await writeFile(file, "user replacement");
  expect(() => store.extractAssets(output)).toThrow(/Refusing to replace/);
  expect(await readFile(file, "utf8")).toBe("user replacement");
});

it("rejects traversal outside the extraction directory", async () => {
  const { directory, source, output } = await fixture("../escaped.wav");
  using store = ProjectStore.open(source);
  expect(() => store.extractAssets(output)).toThrow(/Unsafe asset path/);
  expect(await readdir(directory)).not.toContain("escaped.wav");
});

it("rejects linked parent directories before writing outside the destination", async () => {
  const { directory, source, output } = await fixture("media/nested/audio.wav");
  const outside = join(directory, "outside");
  await mkdir(outside);
  await mkdir(output);
  await symlink(outside, join(output, "media"), process.platform === "win32" ? "junction" : "dir");
  using store = ProjectStore.open(source);
  expect(() => store.extractAssets(output)).toThrow(/Unsafe asset path/);
  expect(await readdir(outside)).toEqual([]);
});

it("rejects directory links at the output filename", async () => {
  const { directory, source, output } = await fixture("audio.wav");
  const outside = join(directory, "outside");
  await mkdir(outside);
  await mkdir(output);
  await symlink(
    outside,
    join(output, "audio.wav"),
    process.platform === "win32" ? "junction" : "dir",
  );
  using store = ProjectStore.open(source);
  expect(() => store.extractAssets(output)).toThrow(/Unsafe asset path/);
  expect(await readdir(outside)).toEqual([]);
});
