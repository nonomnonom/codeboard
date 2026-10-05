import { mkdtemp, mkdir, readFile, rm, symlink, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = await mkdtemp(join(tmpdir(), "codeboard-distribution-"));
function run(command, args, cwd = directory) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} failed (${result.status}): ${result.stderr}\n${result.stdout}`);
  return result.stdout;
}
try {
  assert(process.env.npm_execpath, "Run this verifier with npm run test:package");
  const [packed] = JSON.parse(
    run(
      process.execPath,
      [
        process.env.npm_execpath,
        "pack",
        "--json",
        "--ignore-scripts",
        "--pack-destination",
        directory,
      ],
      root,
    ),
  );
  for (const file of packed.files)
    assert(
      file.path.startsWith("dist/src/") ||
        ["package.json", "README.md", "LICENSE", "NOTICE"].includes(file.path),
      `Unexpected runtime file: ${file.path}`,
    );
  assert(
    packed.files.some((file) => file.path === "dist/src/index.js"),
    "Missing public entry point",
  );
  const modules = join(directory, "node_modules"),
    installed = join(modules, "codeboard-studio");
  if (process.argv.includes("--install")) {
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({ private: true, type: "module" }),
    );
    run(process.execPath, [
      process.env.npm_execpath,
      "install",
      "--no-audit",
      "--no-fund",
      join(directory, packed.filename),
    ]);
  } else {
    await mkdir(installed, { recursive: true });
    run("tar", ["-xzf", join(directory, packed.filename), "--strip-components=1", "-C", installed]);
    const metadata = JSON.parse(await readFile(join(installed, "package.json"), "utf8"));
    // Reuse pinned installed dependencies; the engine under test comes only from the archive.
    for (const name of Object.keys(metadata.dependencies)) {
      const destination = join(modules, name);
      await mkdir(resolve(destination, ".."), { recursive: true });
      await symlink(
        join(root, "node_modules", name),
        destination,
        process.platform === "win32" ? "junction" : "dir",
      );
    }
  }
  const metadata = JSON.parse(await readFile(join(installed, "package.json"), "utf8"));
  const worker = join(directory, "smoke.mjs");
  await writeFile(worker, await readFile(join(root, "scripts/package-smoke.mjs")));
  process.stdout.write(run(process.execPath, [worker]));
  const help = run(process.execPath, [join(installed, metadata.bin.codeboard), "--help"]);
  assert(help.includes("inspect") && help.includes("movie"), "Packaged CLI is incomplete");
  assert(!/\bupdate\b/.test(help), "Removed self-updater is still exposed");
  assert.equal(
    run(process.execPath, [join(installed, metadata.bin.codeboard), "--version"]).trim(),
    metadata.version,
    "CLI version differs from package version",
  );
  if (process.argv.includes("--install")) {
    const npmArgs = [process.env.npm_execpath, "exec", "--no", "--", "codeboard"];
    assert.equal(
      run(process.execPath, [...npmArgs, "--version"]).trim(),
      metadata.version,
      "npm CLI shim version differs from package version",
    );
    run(process.execPath, [...npmArgs, "init"]);
    run(process.execPath, [...npmArgs, "run", "scene.mjs"]);
    for (const name of ["first.png", "first.cboard"])
      assert((await stat(join(directory, "output", name))).size > 0, `CLI did not create ${name}`);
  }
  console.log(
    `Local archive verified: ${packed.files.length} files, ${packed.size} compressed bytes; extracted API and CLI passed`,
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
