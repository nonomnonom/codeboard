import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, writeFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const plugin = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(plugin, "..");
const [parent, codexEntry] = process.argv.slice(2);
assert.ok(
  parent && codexEntry,
  "Usage: node plugin/evals/prepare-installed.mjs <temporary-parent> <codex-entry.js>",
);
await access(resolve(codexEntry));
await mkdir(resolve(parent), { recursive: true });
const stage = await mkdtemp(join(resolve(parent), "installed-"));
const runtime = join(stage, "runtime");
const distribution = join(stage, "distribution");
const host = join(stage, "host");
await mkdir(runtime);
await mkdir(distribution);
await mkdir(host);
// Stage the built package layout and existing dependencies; no checkout docs or source.
for (const path of ["package.json", "dist/src", "node_modules", "LICENSE", "NOTICE"]) {
  await cp(join(repo, path), join(runtime, path), { recursive: true, dereference: true });
}
for (const path of [".agents", ".codex-plugin", ".claude-plugin", "plugin.json", "skills"]) {
  await cp(join(plugin, path), join(distribution, path), { recursive: true, dereference: true });
}
function run(args, options = {}) {
  const result = spawnSync(process.execPath, args, { cwd: stage, encoding: "utf8", ...options });
  assert.equal(result.status, 0, result.error?.message ?? `${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
const env = { ...process.env, CODEX_HOME: host };
const installLog =
  run([resolve(codexEntry), "plugin", "marketplace", "add", distribution], { env }) +
  run([resolve(codexEntry), "plugin", "add", "codeboard@codeboard-local"], { env });
await writeFile(join(stage, "install.log"), installLog);
const manifest = JSON.parse(await readFile(join(plugin, ".codex-plugin/plugin.json"), "utf8"));
const installed = join(host, "plugins/cache/codeboard-local/codeboard", manifest.version);
const reference = join(installed, "skills/codeboard/references/engine");
const bundle = JSON.parse(await readFile(join(reference, "bundle.json"), "utf8"));
for (const [path, hash] of Object.entries(bundle.bundledHashes)) {
  assert.equal(
    createHash("sha256")
      .update(await readFile(join(reference, path)))
      .digest("hex"),
    hash,
    path,
  );
}
for (const skill of await readdir(join(plugin, "skills"))) {
  assert.deepEqual(
    await readFile(join(installed, "skills", skill, "SKILL.md")),
    await readFile(join(plugin, "skills", skill, "SKILL.md")),
    skill,
  );
}
const prepared = run([join(plugin, "evals/run.mjs"), "prepare", join(stage, "tasks")]);
const tasks = join(stage, "tasks");
const runDirectory = join(
  tasks,
  (await readdir(tasks)).find((name) => name.startsWith("run-")),
);
for (const id of ["hold", "retime", "brush"]) {
  const file = join(runDirectory, id, "task.md");
  let task = await readFile(file, "utf8");
  task = task.replaceAll(repo, runtime).replace("Engine checkout:", "Installed-layout runtime:");
  task += `\nInstalled plugin: ${installed}\nRead skills and bundled references here. No repository docs/source or network access for this trial.\n`;
  await writeFile(file, task);
}
await writeFile(
  join(stage, "environment.json"),
  JSON.stringify(
    {
      node: process.version,
      platform: process.platform,
      engineVersion: bundle.engineVersion,
      pluginVersion: manifest.version,
      bundledFilesVerified: Object.keys(bundle.bundledHashes).length,
      runtime,
      installed,
      runDirectory,
      isolation:
        "Separate files and fresh host installation; agent scope restriction, not an OS sandbox.",
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ stage, runtime, installed, runDirectory, prepared }, null, 2));
