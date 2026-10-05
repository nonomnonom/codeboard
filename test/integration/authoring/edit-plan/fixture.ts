import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync, spawn } from "node:child_process";
import { StoryboardProject, brushes } from "../../../../src/index.js";
import { onTestFinished } from "vitest";

export async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "codeboard-plan-"));
  onTestFinished(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "project.cboard"),
    project = StoryboardProject.create({ title: "Plan", width: 48, height: 32 });
  const panel = project.addScene("Scene").addShot("Shot").addPanel({ durationFrames: 24 });
  const layer = panel.addRasterLayer("Ink");
  layer.rasterStroke(
    [
      { x: 4, y: 8, pressure: 1 },
      { x: 32, y: 8, pressure: 1 },
    ],
    brushes.cleanInk,
  );
  await project.save(path);
  return { dir, path, project, panel, layer };
}

export function cli(args: string[]) {
  return spawnSync(process.execPath, [resolve("dist/src/cli.js"), ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
}

export function concurrentCLI(
  args: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((accept, reject) => {
    const child = spawn(process.execPath, [resolve("dist/src/cli.js"), ...args], {
      windowsHide: true,
    });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => accept({ code, stdout, stderr }));
  });
}
