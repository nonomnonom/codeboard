import { expect, it } from "vitest";
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { FontLibrary } from "skia-canvas";
import {
  StoryboardProject,
  createFrameJob,
  runFrameJob,
  inspectFrameJob,
  readFrameJobFrame,
  renderShotFramePNG,
} from "../../../src/index.js";

it("loads checksum-pinned fonts in a fresh worker after source relocation without changing saved text", async () => {
  await mkdir(resolve(".preview"), { recursive: true });
  const directory = await mkdtemp(resolve(".preview/font-files-"));
  try {
    const original = join(directory, "original"),
      moved = join(directory, "moved");
    await mkdir(original);
    await mkdir(moved);
    const font = await readFile("website/public/fonts/dm-sans.woff2");
    await writeFile(join(original, "actor.woff2"), font);
    const project = StoryboardProject.create({ title: "Pinned type", width: 128, height: 64 });
    const panel = project.addScene("S").addShot("S").addPanel({ durationFrames: 3 });
    panel
      .addVectorLayer("Type")
      .text("Hello", 8, 32, { font: '20px "Pinned Actor", serif', color: "black" });
    project.capturePanelAnimation(panel.id, { id: "shot" });
    const source = join(original, "source.cboard"),
      job = join(directory, "job.sqlite");
    await project.save(source);
    const sourceBytes = await readFile(source);
    const options = {
      expectedVersion: project.version,
      target: { kind: "shot" as const, animationId: "shot" },
      fontPolicy: "require-available" as const,
      fontFiles: [
        {
          family: "Pinned Actor",
          path: "actor.woff2",
          sha256: createHash("sha256").update(font).digest("hex"),
        },
      ],
    };
    createFrameJob(source, job, options);
    await expect(
      runFrameJob(job, {
        onProgress(completed) {
          if (completed === 1) FontLibrary.reset();
        },
      }),
    ).rejects.toMatchObject({ code: "MISSING_DEPENDENCY" });
    expect(inspectFrameJob(job).completed).toBe(1);
    const first = readFrameJobFrame(job, 0);
    expect(await readFile(source)).toEqual(sourceBytes);
    expect(FontLibrary.has("Pinned Actor")).toBe(false);
    FontLibrary.use("Pinned Actor", join(original, "actor.woff2"));
    expect(first).toEqual(await renderShotFramePNG(project.shotAnimation("shot"), 0));
    FontLibrary.reset();
    const relocated = join(moved, "source.cboard");
    await copyFile(source, relocated);
    await writeFile(join(moved, "actor.woff2"), Buffer.from("changed font"));
    await expect(runFrameJob(job, { sourcePath: relocated })).rejects.toMatchObject({
      code: "ASSET_CHECKSUM_MISMATCH",
    });
    expect(inspectFrameJob(job).completed).toBe(1);
    await rm(join(moved, "actor.woff2"));
    await expect(runFrameJob(job, { sourcePath: relocated })).rejects.toMatchObject({
      code: "ASSET_MISSING",
    });
    await writeFile(join(moved, "actor.woff2"), font);
    await rm(join(original, "actor.woff2"));
    FontLibrary.reset();
    const child = spawnSync(
      process.execPath,
      ["--import", "tsx", "test/fixtures/frame-job-worker.ts", job, "", relocated],
      { cwd: resolve("."), encoding: "utf8", windowsHide: true, timeout: 30_000 },
    );
    expect({
      status: child.status,
      error: child.error,
      stderr: child.status ? child.stderr : "",
    }).toEqual({ status: 0, error: undefined, stderr: "" });
    expect(JSON.parse(child.stdout)).toMatchObject({ rendered: 2, reused: 1, complete: true });
    expect(readFrameJobFrame(job, 1)).toEqual(first);
    expect(readFrameJobFrame(job, 2)).toEqual(first);
    expect(await readFile(relocated)).toEqual(sourceBytes);
    for (const path of ["../actor.woff2", "/actor.woff2", "C:/actor.woff2"]) {
      const invalid = join(directory, "invalid.sqlite");
      expect(() =>
        createFrameJob(relocated, invalid, {
          ...options,
          fontFiles: [{ ...options.fontFiles[0]!, path }],
        }),
      ).toThrow();
      await expect(access(invalid)).rejects.toThrow();
    }
  } finally {
    FontLibrary.reset();
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);
