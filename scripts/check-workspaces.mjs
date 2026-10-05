import assert from "node:assert/strict";
import { readFile, realpath, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const engine = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
assert.equal(engine.name, "codeboard-studio");
assert.deepEqual(engine.workspaces, [".", "examples", "website"]);
const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
assert.equal(lock.packages.examples.name, "@codeboard/examples");
assert.ok(
  !Object.keys(lock.packages).some((path) => path.startsWith("examples/")),
  "Lockfile must not retain obsolete per-example workspaces",
);
const expectedEntry = await realpath(join(root, engine.exports["."].import));
const expectedTypes = await realpath(join(root, engine.exports["."].types));
const examples = (await readdir(join(root, "examples"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !["src", "output", "node_modules"].includes(entry.name))
  .map((entry) => `examples/${entry.name}`);
const workspace = JSON.parse(await readFile(join(root, "examples/package.json"), "utf8"));
const declared = [
  ...new Set(
    Object.keys(workspace.scripts)
      .filter((name) => name.includes(":"))
      .map((name) => `examples/${name.split(":")[0]}`),
  ),
];
assert.deepEqual(declared.sort(), [...examples].sort(), "Every example needs shared commands");
for (const directory of [...examples, "website"]) {
  const manifestPath = join(
    root,
    directory.startsWith("examples/") ? "examples" : directory,
    "package.json",
  );
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (directory.startsWith("examples/")) {
    await readFile(join(root, directory, "src/config.ts"), "utf8");
    const config = JSON.parse(await readFile(join(root, "examples/tsconfig.json"), "utf8"));
    assert.deepEqual(
      config.include,
      ["src/**/*.ts", "*/src/**/*.ts"],
      `${directory} must keep executable source under src`,
    );
    assert.deepEqual(
      config.compilerOptions.paths,
      {},
      `${directory} must consume public declarations`,
    );
    const entries = await readdir(join(root, directory));
    assert.ok(
      !entries.some((name) => /\.(?:[cm]?js|tsx?)$/.test(name)),
      `${directory} has source outside src`,
    );
    assert.ok(!entries.includes("package-lock.json"), `${directory} must use the root lockfile`);
    assert.ok(
      !entries.includes("package.json"),
      `${directory} must use the shared examples manifest`,
    );
    assert.ok(
      !entries.includes("tsconfig.json"),
      `${directory} must use the shared TypeScript config`,
    );
  }
  assert.equal(manifest.private, true, `${directory} must not publish example dependencies`);
  assert.equal(
    manifest.dependencies["codeboard-studio"],
    "file:..",
    `${directory} must use the local engine`,
  );
  const linkedRoot = await realpath(join(root, "node_modules/codeboard-studio"));
  assert.equal(linkedRoot, await realpath(root), "Engine dependency points outside this checkout");
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", 'console.log(import.meta.resolve("codeboard-studio"))'],
    { cwd: join(root, directory), encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    await realpath(fileURLToPath(result.stdout.trim())),
    expectedEntry,
    `${directory} resolved a different runtime`,
  );
  assert.equal(await realpath(join(linkedRoot, engine.exports["."].types)), expectedTypes);
  console.log(`${directory}: shared workspace, local runtime and declarations (${engine.version})`);
}
