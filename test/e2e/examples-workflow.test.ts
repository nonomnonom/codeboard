import { expect, test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { unzipSync } from "fflate";
import { StoryboardProject } from "../../src/index.js";

const cli = resolve("dist/src/cli.js");
function run(
  cwd: string,
  script: string,
  args: string[] = [],
  env: NodeJS.ProcessEnv = process.env,
) {
  return spawnSync(process.execPath, [cli, "run", resolve(script), ...args], {
    cwd,
    env,
    encoding: "utf8",
    windowsHide: true,
    timeout: 60000,
  });
}

test("persisted example revision replays only the same intent and preserves saved state on mismatch", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-example-plan-"));
  try {
    const output = join(directory, "drawing");
    const authored = run(directory, "examples/quickstart/src/cli/run.ts", [output]);
    assert.equal(authored.status, 0, authored.stderr);
    const file = join(output, "first-stroke.cboard");
    const plan = join(output, "revision.json");
    const args = [file, "first-stroke", plan, "Explicit fixture caption"];
    const result = run(directory, "examples/agent-revision/src/cli/run.ts", args);
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(result.stdout);
    expect(receipt.replayed).toBe(false);
    expect(receipt.visualReview).toBe("pending");
    const saved = await StoryboardProject.open(file);
    expect(saved.toJSON().panels.find((panel) => panel.id === "first-stroke")?.dialogue).toBe(
      "Explicit fixture caption",
    );
    const replay = run(directory, "examples/agent-revision/src/cli/run.ts", args);
    assert.equal(replay.status, 0, replay.stderr);
    expect(JSON.parse(replay.stdout).replayed).toBe(true);
    expect((await StoryboardProject.open(file)).version).toBe(saved.version);
    const persisted = JSON.parse(await readFile(plan, "utf8"));
    persisted.commands = persisted.commands.map((command: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(command).reverse()),
    );
    await writeFile(plan, JSON.stringify(persisted));
    const reordered = run(directory, "examples/agent-revision/src/cli/run.ts", args);
    expect(reordered.status, reordered.stderr).toBe(0);
    expect(JSON.parse(reordered.stdout).replayed).toBe(true);
    const bytes = await readFile(file);
    const changedIntent = run(directory, "examples/agent-revision/src/cli/run.ts", [
      ...args.slice(0, 3),
      "Different caption",
    ]);
    expect(changedIntent.status).not.toBe(0);
    expect(changedIntent.stderr).toContain("does not match");
    expect(await readFile(file)).toEqual(bytes);
    await writeFile(plan, '{"digest":"invalid","commands":[]}');
    expect(run(directory, "examples/agent-revision/src/cli/run.ts", args).status).not.toBe(0);
    expect(await readFile(file)).toEqual(bytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 60000);

test("presentation render opens saved state without regenerating it, including on encoder failure", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-example-render-"));
  try {
    const output = join(directory, "output");
    await mkdir(join(output, "launch"), { recursive: true });
    const file = join(output, "launch", "codeboard-launch.cboard");
    const project = StoryboardProject.create({
      title: "Independent revision",
      width: 64,
      height: 64,
    });
    project
      .addScene("Saved")
      .addShot("Only this shot")
      .addPanel({ id: "saved", durationFrames: 2 });
    await project.save(file);
    const bytes = await readFile(file);
    const result = run(directory, "examples/code-board-demo/src/cli/presentation.ts", ["render"], {
      ...process.env,
      CODEBOARD_DEMO_OUTPUT: output,
      FFMPEG_PATH: join(directory, "missing-encoder"),
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/ffmpeg|encoder|ENOENT/i);
    expect(await readFile(file)).toEqual(bytes);
    expect((await StoryboardProject.open(file)).toJSON().title).toBe("Independent revision");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 60000);

test.each([
  "quickstart",
  "studies",
  "agent-revision",
  "last-light",
  "lengkap",
  "code-board-demo",
  "studio-timing",
])(
  "download %s has self-contained strict TypeScript source",
  async (archive) => {
    const directory = await mkdtemp(join(tmpdir(), "codeboard-example-types-"));
    try {
      const files = unzipSync(await readFile(`website/public/art/examples/${archive}.zip`));
      for (const [name, bytes] of Object.entries(files)) {
        const file = resolve(directory, name);
        expect(file.startsWith(directory + sep)).toBe(true);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, bytes);
      }
      const cwd = join(directory, archive);
      const config = JSON.parse(await readFile(join(cwd, "tsconfig.json"), "utf8"));
      expect(config.compilerOptions.strict).toBe(true);
      expect(config.compilerOptions.verbatimModuleSyntax).toBe(true);
      expect(config.compilerOptions.noUncheckedIndexedAccess).toBe(true);
      expect(config.compilerOptions.exactOptionalPropertyTypes).toBe(true);
      // Substitute only dependency resolution; compile the exact downloaded sources against public declarations.
      config.compilerOptions.paths = { "codeboard-studio": [resolve("dist/src/index.d.ts")] };
      config.compilerOptions.typeRoots = [resolve("node_modules/@types")];
      await writeFile(join(cwd, "tsconfig.json"), JSON.stringify(config));
      const result = spawnSync(
        process.execPath,
        [resolve("node_modules/typescript/bin/tsc"), "-p", join(cwd, "tsconfig.json")],
        {
          cwd,
          encoding: "utf8",
          windowsHide: true,
          timeout: 30000,
        },
      );
      assert.equal(result.status, 0, result.stdout + result.stderr);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  60000,
);
