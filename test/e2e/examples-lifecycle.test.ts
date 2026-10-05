import { expect, it, onTestFinished } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { StoryboardProject } from "../../src/index.js";

function run(script: string, output: string, args: string[] = []) {
  return spawnSync(
    process.execPath,
    [resolve("dist/src/cli.js"), "run", resolve(script), ...args],
    {
      cwd: output,
      encoding: "utf8",
      windowsHide: true,
      timeout: 60000,
      env: { ...process.env, CODEBOARD_EXAMPLE_OUTPUT: output, CODEBOARD_DEMO_OUTPUT: output },
    },
  );
}
async function directory() {
  const path = await mkdtemp(join(tmpdir(), "codeboard-example-lifecycle-"));
  onTestFinished(() => rm(path, { recursive: true, force: true }));
  return path;
}

it("studio revision rejects a valid plan for a different operation without changing saved work", async () => {
  const output = await directory();
  const authored = run("examples/studio-timing/src/cli/run.ts", output, ["author"]);
  expect(authored.status, authored.stderr).toBe(0);
  const file = join(output, "timing.cboard");
  const project = await StoryboardProject.open(file);
  const bytes = await readFile(file);
  const unrelated = project.plan("Another operation", [
    { op: "project.metadata", key: "unrelated", value: "must not be committed" },
  ]);
  await writeFile(join(output, "revision-plan.json"), JSON.stringify(unrelated));
  const revision = run("examples/studio-timing/src/cli/run.ts", output, ["revise"]);
  expect(revision.status).not.toBe(0);
  expect(revision.stderr).toContain("does not match");
  expect(await readFile(file)).toEqual(bytes);
});

it.each([
  ["quickstart", "src/cli/run.ts", "first-stroke.cboard", []],
  ["last-light", "src/cli/run.ts", "last-light.cboard", []],
  ["lengkap", "src/cli/run.ts", "lengkap.cboard", []],
  ["studio-timing", "src/cli/run.ts", "timing.cboard", ["author"]],
  ["code-board-demo", "src/study/main.ts", "clawd.cboard", []],
  ["code-board-demo", "src/cli/presentation.ts", "performance/clawd-final.cboard", ["author"]],
] as const)(
  "%s %s preserves an existing project and its assets",
  async (example, entry, name, args) => {
    const output = await directory();
    const file = join(output, name);
    await mkdir(dirname(file), { recursive: true });
    const project = StoryboardProject.create({ title: "User-edited work", width: 8, height: 8 });
    project.addScene("Saved").addShot("Saved").addPanel({ durationFrames: 1 });
    await project.save(file);
    const bytes = await readFile(file);
    const asset = join(output, "lengkap-foley.wav");
    await writeFile(asset, "user-owned sound");
    const result = run(`examples/${example}/${entry}`, output, [...args]);
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(await readFile(file)).toEqual(bytes);
    expect(await readFile(asset, "utf8")).toBe("user-owned sound");
  },
);

it("quickstart render uses saved edits without replacing the source project", async () => {
  const output = await directory();
  const file = join(output, "first-stroke.cboard");
  const project = StoryboardProject.create({
    title: "User-edited work",
    width: 8,
    height: 8,
    background: "#ff0000",
  });
  project.addScene("Saved").addShot("Saved").addPanel({ durationFrames: 48 });
  await project.save(file);
  const bytes = await readFile(file);
  const result = run("examples/quickstart/src/cli/render.ts", output);
  expect(result.status, result.stderr).toBe(0);
  expect(await readFile(file)).toEqual(bytes);
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(await readFile(join(output, "first-stroke.png")))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect([info.width, info.height]).toEqual([8, 8]);
  expect([...data]).toEqual(Array.from({ length: 64 }, () => [255, 0, 0, 255]).flat());
});
