import { expect, test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

test("authoring from an unrelated directory resolves the bundled API and preserves arguments and failures", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-authoring-"));
  const cli = resolve("dist/src/cli.js");
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [cli, ...args], {
      cwd: directory,
      encoding: "utf8",
      windowsHide: true,
    });
  try {
    expect(run("init").status).toBe(0);
    const source = await readFile(join(directory, "scene.mjs"), "utf8");
    expect(run("init").status).not.toBe(0);
    expect(await readFile(join(directory, "scene.mjs"), "utf8")).toBe(source);
    const result = run("run", "scene.mjs");
    assert.equal(result.status, 0, result.stderr);
    expect((await readFile(join(directory, "output/first.png"))).subarray(1, 4).toString()).toBe(
      "PNG",
    );
    await writeFile(
      join(directory, "helper.mts"),
      "import { brushes } from 'codeboard-studio'; export const name: string = brushes.cleanInk.name;",
    );
    await writeFile(
      join(directory, "check.mts"),
      "import { name } from './helper.mts'; console.log(JSON.stringify({name,args:process.argv.slice(2)}));",
    );
    const ts = run("run", "check.mts", "--flag", "two words");
    assert.equal(ts.status, 0, ts.stderr);
    expect(JSON.parse(ts.stdout).args).toEqual(["--flag", "two words"]);
    await writeFile(join(directory, "fail.mjs"), "process.exitCode = 7;");
    expect(run("run", "fail.mjs").status).toBe(7);
    expect(run("run", "missing.mjs").status).not.toBe(0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
