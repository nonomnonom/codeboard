import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
});

async function fixture(declaration: string) {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-version-"));
  folders.push(directory);
  const manifests = [
    "plugin/plugin.json",
    "plugin/.codex-plugin/plugin.json",
    "plugin/.claude-plugin/plugin.json",
  ];
  for (const path of ["scripts", "website/lib", "plugin/.codex-plugin", "plugin/.claude-plugin"])
    await mkdir(join(directory, path), { recursive: true });
  await writeFile(
    join(directory, "scripts/sync-release-version.mjs"),
    await readFile("scripts/sync-release-version.mjs"),
  );
  await writeFile(join(directory, "package.json"), JSON.stringify({ version: "1.0.0" }));
  for (const path of manifests)
    await writeFile(
      join(directory, path),
      '{\n  "name": "codeboard",\n  "version": "0.3.0",\n  "keywords": ["drawing", "animation"]\n}\n',
    );
  await writeFile(join(directory, "website/lib/shared.ts"), declaration);
  await writeFile(
    join(directory, "plugin/README.md"),
    "referensi API Codeboard 0.3.0\nVersi plugin: **0.3.0**\n",
  );
  const run = () =>
    spawnSync(process.execPath, [join(directory, "scripts/sync-release-version.mjs")], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 10000,
    });
  return { directory, manifests, run };
}

it("synchronizes both formatted website quote styles and all plugin versions", async () => {
  for (const quote of ["'", '"']) {
    const { directory, manifests, run } = await fixture(
      `export const releaseVersion = ${quote}0.3.0${quote};`,
    );
    expect(run().status).toBe(0);
    expect(await readFile(join(directory, "website/lib/shared.ts"), "utf8")).toBe(
      'export const releaseVersion = "1.0.0";',
    );
    for (const path of manifests) {
      expect(JSON.parse(await readFile(join(directory, path), "utf8")).version).toBe("1.0.0");
      expect(await readFile(join(directory, path), "utf8")).toContain(
        '  "keywords": ["drawing", "animation"]\n',
      );
    }
    expect(await readFile(join(directory, "plugin/README.md"), "utf8")).not.toContain("0.3.0");
  }
});

it("rejects missing or ambiguous website declarations before updating plugin metadata", async () => {
  for (const source of [
    "export const other = 1;",
    'export const releaseVersion = "0.3.0";\nexport const releaseVersion = "0.3.0";',
  ]) {
    const { directory, manifests, run } = await fixture(source);
    const result = run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Expected exactly one");
    for (const path of manifests)
      expect(JSON.parse(await readFile(join(directory, path), "utf8")).version).toBe("0.3.0");
    expect(await readFile(join(directory, "website/lib/shared.ts"), "utf8")).toBe(source);
  }
});
