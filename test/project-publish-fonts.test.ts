import { mkdtemp, mkdir, readFile, writeFile, rm, rename, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { FontLibrary } from "skia-canvas";
import {
  StoryboardProject,
  publishProject,
  verifyProjectPublish,
  createFrameJob,
  runFrameJob,
  readFrameJobFrame,
} from "../src/index.js";

it("publishes relocatable font bytes and renders without the original font or source", async () => {
  await mkdir(resolve(".preview"), { recursive: true });
  const directory = await mkdtemp(resolve(".preview/publish-fonts-"));
  try {
    const font = await readFile("website/public/fonts/dm-sans.woff2");
    const source = join(directory, "source.cboard"),
      original = join(directory, "title.woff2");
    await writeFile(original, font);
    const project = StoryboardProject.create({ title: "Font handoff", width: 128, height: 64 });
    const panel = project.addScene("S").addShot("S").addPanel({ durationFrames: 2 });
    panel
      .addVectorLayer("Text")
      .text("Handoff", 8, 32, { font: '20px "Handoff Title"', color: "black" });
    project.capturePanelAnimation(panel.id, { id: "shot" });
    await project.save(source);
    const fontFiles = [
      {
        family: "Handoff Title",
        path: "title.woff2",
        sha256: createHash("sha256").update(font).digest("hex"),
      },
    ];
    const jobOptions = {
      expectedVersion: project.version,
      target: { kind: "shot" as const, animationId: "shot" },
      fontPolicy: "require-available" as const,
      fontFiles,
    };
    const referenceJob = join(directory, "reference.sqlite");
    createFrameJob(source, referenceJob, jobOptions);
    await runFrameJob(referenceJob);
    const expected = readFrameJobFrame(referenceJob, 0);
    const output = join(directory, "publishes");
    const result = await publishProject(source, output, {
      expectedVersion: project.version,
      fontFiles,
    });
    expect(result.manifest.fontFiles).toEqual([{ ...fontFiles[0], path: "fonts/0.woff2" }]);
    expect(result.manifest.externalFonts).toEqual(['20px "Handoff Title"']);
    const moved = join(directory, "moved");
    await rename(result.directory, moved);
    await rm(source);
    await rm(original);
    FontLibrary.reset();
    const verified = await verifyProjectPublish(moved, {
      expectedManifestHash: result.manifestHash,
    });
    const job = join(directory, "restored.sqlite");
    createFrameJob(verified.projectFile, job, {
      ...jobOptions,
      fontFiles: verified.manifest.fontFiles!,
    });
    const child = spawnSync(
      process.execPath,
      ["--import", "tsx", "test/fixtures/frame-job-worker.ts", job],
      { cwd: resolve("."), encoding: "utf8", windowsHide: true, timeout: 30_000 },
    );
    expect({
      status: child.status,
      error: child.error,
      stderr: child.status ? child.stderr : "",
    }).toEqual({ status: 0, error: undefined, stderr: "" });
    expect(readFrameJobFrame(job, 0)).toEqual(expected);
    expect(readFrameJobFrame(job, 1)).toEqual(expected);
    const bundledFont = join(moved, "fonts/0.woff2");
    await writeFile(bundledFont, "corrupt");
    await expect(verifyProjectPublish(moved)).rejects.toMatchObject({
      code: "ASSET_CHECKSUM_MISMATCH",
    });
    await rm(bundledFont);
    await expect(verifyProjectPublish(moved)).rejects.toMatchObject({ code: "ASSET_MISSING" });
    await writeFile(bundledFont, font);
    expect((await verifyProjectPublish(moved)).runtimeMatches).toBe(true);
    await expect(
      publishProject(verified.projectFile, output, {
        expectedVersion: project.version,
        fontFiles: [{ ...fontFiles[0]!, path: "../outside.woff2" }],
      }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    expect(await readdir(output)).toEqual([]);
  } finally {
    FontLibrary.reset();
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);
