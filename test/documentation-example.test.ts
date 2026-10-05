import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { unzipSync } from "fflate";
import {
  StoryboardProject,
  renderFramePNG,
  renderOnionSkin,
  evaluateCamera,
  evaluateDrawing,
} from "../src/index.js";

test("downloaded documentation example runs outside the repository and revises only the intended exposure", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-doc-example-"));
  try {
    const files = unzipSync(await readFile("website/public/art/examples/code-board-demo.zip"));
    for (const [name, bytes] of Object.entries(files)) {
      const target = resolve(directory, name);
      if (!target.startsWith(directory + sep)) throw new Error("Invalid example archive path");
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
    const cwd = join(directory, "code-board-demo");
    const run = (file: string) =>
      spawnSync(process.execPath, [resolve("dist/src/cli.js"), "run", file], {
        cwd,
        encoding: "utf8",
        windowsHide: true,
        timeout: 30000,
      });
    const authored = run("src/study/main.ts");
    assert.equal(authored.status, 0, authored.stderr);
    const path = join(cwd, "output", "clawd.cboard");
    const before = await StoryboardProject.open(path);
    const unchanged = await renderFramePNG(before, 0);
    const original = await renderFramePNG(before, 128);
    const afterRange = await renderFramePNG(before, 130);
    const result = run("src/cli/revise.ts");
    assert.equal(result.status, 0, result.stderr);
    const after = await StoryboardProject.open(path);
    expect(await renderFramePNG(after, 0)).toEqual(unchanged);
    expect(await renderFramePNG(after, 130)).toEqual(afterRange);
    expect(await renderFramePNG(after, 128)).not.toEqual(original);
    expect(after.production.inspect().durationFrames).toBe(192);
    const sequence = after.production.drawingSequence("clawd");
    expect(evaluateDrawing(sequence.keys ?? [], 128)).toBe(
      evaluateDrawing(sequence.keys ?? [], 124),
    );
    const camera = after.production.addCameraKeyframe("hop", 128, { x: 60, y: 160, zoom: 2 });
    expect(evaluateCamera(after.production.cameraKeyframes("hop"), 128).zoom).toBe(2);
    expect(await renderFramePNG(after, 128)).not.toEqual(original);
    after.production.removeCameraKeyframe("hop", camera);
    const ghost = await renderOnionSkin(
      after,
      [
        { panelId: "performance", frame: 128 },
        { panelId: "performance", frame: 124, layerIds: ["clawd"], tint: "#69aeba", opacity: 0.28 },
      ],
      { camera: false },
    );
    expect(ghost.subarray(1, 4).toString()).toBe("PNG");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 60000);

test("documented pixel, custom-tip and joint-rig recipes execute through the installed authoring runner", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-doc-recipes-"));
  try {
    for (const [file, marker, assertion] of [
      [
        "pixels",
        "const polygon =",
        'if (image.pixels.every(value => value === 0)) throw new Error("Empty pixel recipe");',
      ],
      [
        "brushes",
        "const tip = brushTipFromFunction",
        'if (tip.kind !== "bitmap") throw new Error("Missing custom tip");',
      ],
      [
        "math",
        "const shoulder =",
        'if (!result.reachable) throw new Error("Rig target should be reachable");',
      ],
    ]) {
      const markdown = await readFile(`docs/${file}.md`, "utf8");
      const block = [...markdown.matchAll(/```(?:ts|js)\r?\n([\s\S]*?)```/g)].find((match) =>
        match[1]!.includes(marker!),
      )?.[1];
      assert.notEqual(block, undefined, `Missing ${file} recipe`);
      const script = join(directory, `${file}.ts`);
      await writeFile(
        script,
        `import * as cb from 'codeboard-studio';
import { writeFile } from 'node:fs/promises';
const { brushes, customizeBrush, renderBrushSwatch } = cb;
const project = cb.StoryboardProject.create({title:'Documentation recipe',width:640,height:480});
const panel = project.addScene('Study').addShot('Recipe').addPanel();
const paint = panel.addRasterLayer('Paint');
${block}\n${assertion}`,
      );
      const result = spawnSync(process.execPath, [resolve("dist/src/cli.js"), "run", script], {
        cwd: directory,
        encoding: "utf8",
        windowsHide: true,
        timeout: 15000,
      });
      assert.equal(result.status, 0, `${file}: ${result.stderr}`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 60000);
