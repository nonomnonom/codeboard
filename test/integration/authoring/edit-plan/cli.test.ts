import { expect, it } from "vitest";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { StoryboardProject, ProjectStore } from "../../../../src/index.js";
import { fixture, cli, concurrentCLI } from "./fixture.js";

it("CLI plans and concurrently retries a request once, then retrieves its durable receipt", async () => {
  const { project, path, dir } = await fixture();
  const commands = join(dir, "commands.json"),
    planPath = join(dir, "plan.json");
  await writeFile(
    commands,
    JSON.stringify([{ op: "project.configure", changes: { title: "CLI" } }]),
  );
  const planned = cli(["plan", path, commands, "--label", "CLI edit"]);
  assert.equal(planned.status, 0, planned.stderr);
  await writeFile(planPath, planned.stdout);
  const results = await Promise.all([
    concurrentCLI(["commit", path, planPath, "--request-id", "cli"]),
    concurrentCLI(["commit", path, planPath, "--request-id", "cli"]),
  ]);
  for (const result of results) assert.equal(result.code, 0, result.stderr);
  const values = results.map((result) => JSON.parse(result.stdout));
  expect(values.map((value) => value.replayed).sort()).toEqual([false, true]);
  expect(values[0].receipt).toEqual(values[1].receipt);
  expect((await StoryboardProject.open(path)).version).toBe(project.version + 1);
  const read = cli(["receipt", path, "cli"]);
  assert.equal(read.status, 0, read.stderr);
  expect(JSON.parse(read.stdout)).toEqual(values[0].receipt);
});

it("recovers after process death before commit and retries after a lost acknowledgement", async () => {
  const { project, path, dir } = await fixture(),
    before = project.toJSON();
  const plan = project.plan("Crash recovery", [
    { op: "project.configure", changes: { title: "Recovered" } },
  ]);
  const moduleURL = pathToFileURL(resolve("dist/src/index.js")).href;
  const script = join(dir, "crash.mjs");
  await writeFile(
    script,
    `
    import {StoryboardProject} from ${JSON.stringify(moduleURL)};
    import {DatabaseSync} from 'node:sqlite';
    const [path,mode]=process.argv.slice(2);
    const project=await StoryboardProject.open(path);
    if(mode==='before'){
      const original=DatabaseSync.prototype.exec;
      DatabaseSync.prototype.exec=function(sql){
        if(sql.trim().toUpperCase()==='COMMIT' &&
          this.prepare("SELECT hash FROM roots WHERE key='request:crash'").get())process.exit(23);
        return original.call(this,sql);
      };
    }
    await project.commit(${JSON.stringify(plan)},{requestId:'crash'});
    process.exit(24);
  `,
  );
  expect(spawnSync(process.execPath, [script, path, "before"], { windowsHide: true }).status).toBe(
    23,
  );
  using store = ProjectStore.open(path);
  expect(store.readDocument()).toEqual(before);
  expect(store.readReceipt("crash")).toBeNull();
  store.verify();
  expect(spawnSync(process.execPath, [script, path, "after"], { windowsHide: true }).status).toBe(
    24,
  );
  const recovered = await StoryboardProject.open(path),
    receipt = store.readReceipt("crash");
  expect(receipt).not.toBeNull();
  expect(recovered.title).toBe("Recovered");
  expect(await recovered.commit(plan, { requestId: "crash" })).toEqual({ receipt, replayed: true });
  expect(recovered.version).toBe(before.version + 1);
  store.verify();
});
