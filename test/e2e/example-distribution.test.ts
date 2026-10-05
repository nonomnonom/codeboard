import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import { unzipSync } from "fflate";

async function files(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const child of await files(join(directory, entry.name)))
        result.push(`${entry.name}/${child}`);
    } else result.push(entry.name);
  }
  return result.sort();
}

function contentHash(bytes: Uint8Array, path: string): string {
  const content = /\.(?:ts|js|json|md|map|otio)$/.test(path)
    ? Buffer.from(bytes).toString("utf8").replace(/\r\n/g, "\n")
    : bytes;
  return createHash("sha256").update(content).digest("hex");
}

it("ships current example sources and the same current npm runtime in every download", async () => {
  const workspace = JSON.parse(await readFile("examples/package.json", "utf8"));
  const names = [
    ...new Set(
      Object.keys(workspace.scripts)
        .filter((name) => name.includes(":"))
        .map((name) => name.split(":")[0]!),
    ),
  ].sort();
  expect(
    (await readdir("website/public/art/examples")).filter((name) => name.endsWith(".zip")).sort(),
  ).toEqual(names.map((name) => `${name}.zip`));
  const directory = await mkdtemp(join(tmpdir(), "codeboard-example-artifact-"));
  try {
    let runtime: Uint8Array | undefined;
    for (const name of names) {
      const entries = unzipSync(await readFile(`website/public/art/examples/${name}.zip`));
      const documents = (await readdir(`examples/${name}`)).filter((file) => file.endsWith(".md"));
      for (const document of documents) {
        const path = `${name}/${document}`;
        expect(entries[path], `${path} is missing from the download`).toBeDefined();
        const markdown = Buffer.from(entries[path]!).toString("utf8");
        for (const match of markdown.matchAll(/\]\(([^\s)]+)\)/g)) {
          const href = match[1]!;
          if (/^(?:[a-z]+:|\/|#)/i.test(href)) continue;
          const target = posix.normalize(posix.join(name, href.split("#")[0]!));
          expect(entries[target], `${path} links to missing ${target}`).toBeDefined();
        }
      }
      const sourceFiles = await files(`examples/${name}/src`);
      expect(
        Object.keys(entries)
          .filter((path) => path.startsWith(`${name}/src/`))
          .sort(),
        name,
      ).toEqual(sourceFiles.map((path) => `${name}/src/${path}`));
      for (const path of ["README.md", ...sourceFiles.map((file) => `src/${file}`)]) {
        expect(contentHash(entries[`${name}/${path}`]!, path), `${name}/${path} is stale`).toBe(
          contentHash(await readFile(`examples/${name}/${path}`), path),
        );
      }
      const archive = entries[`${name}/vendor/codeboard-studio.tgz`]!;
      expect(archive, `${name} has no npm runtime`).toBeDefined();
      const metadata = JSON.parse(Buffer.from(entries[`${name}/vendor/engine.json`]!).toString());
      expect(metadata.integrity).toBe(
        `sha512-${createHash("sha512").update(archive).digest("base64")}`,
      );
      if (runtime)
        expect(contentHash(archive, "engine.tgz"), `${name} bundles a different runtime`).toBe(
          contentHash(runtime, "engine.tgz"),
        );
      else runtime = archive;
    }
    const archive = join(directory, "engine.tgz");
    await writeFile(archive, runtime!);
    execFileSync("tar", ["-xzf", archive, "-C", directory], { windowsHide: true, timeout: 30_000 });
    const packaged = join(directory, "package");
    const sourceManifest = JSON.parse(await readFile("package.json", "utf8"));
    const manifest = JSON.parse(await readFile(join(packaged, "package.json"), "utf8"));
    for (const key of ["name", "version", "engines", "dependencies", "exports", "bin"]) {
      expect(manifest[key], `Bundled engine ${key} is stale`).toEqual(sourceManifest[key]);
    }
    const runtimeFiles = await files("dist/src");
    expect(await files(join(packaged, "dist/src"))).toEqual(runtimeFiles);
    for (const file of runtimeFiles) {
      expect(
        contentHash(await readFile(join(packaged, "dist/src", file)), file),
        `Bundled runtime ${file} is stale`,
      ).toBe(contentHash(await readFile(join("dist/src", file)), file));
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
