import { expect, it, vi } from "vitest";
import { mkdir, mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { nativeRendererFiles } from "../../../src/runtime/native-identity.js";
import {
  StoryboardProject,
  createFrameJob,
  runFrameJob,
  inspectFrameJob,
  publishProject,
  verifyProjectPublish,
} from "../../../src/index.js";

it("hashes native bytes independently of installation paths and rejects ambiguous loaded copies", async () => {
  await mkdir(resolve(".preview"), { recursive: true });
  const directory = await mkdtemp(resolve(".preview/native-identity-"));
  const originalExcludeEnv = process.report.excludeEnv;
  const report = vi.spyOn(process.report, "getReport");
  try {
    const first = join(directory, "skia.node"),
      second = join(directory, "other", "skia.node");
    await mkdir(join(directory, "other"));
    await writeFile(first, "native fixture A");
    await writeFile(second, "native fixture A");
    report.mockImplementation(() => {
      expect(process.report.excludeEnv).toBe(true);
      return { sharedObjects: [first, second, join(directory, "unrelated.node")] };
    });
    const expected = createHash("sha256").update("native fixture A").digest("hex");
    expect(nativeRendererFiles()).toEqual({ "skia.node": expected });
    expect(process.report.excludeEnv).toBe(originalExcludeEnv);
    await writeFile(second, "native fixture B");
    expect(() => nativeRendererFiles()).toThrow(/Multiple different native renderer files/);
    report.mockReturnValue({ sharedObjects: [second] });
    expect(nativeRendererFiles()["skia.node"]).not.toBe(expected);
    report.mockImplementation(() => {
      throw new Error("Diagnostic unavailable");
    });
    expect(() => nativeRendererFiles()).toThrow("Diagnostic unavailable");
    expect(process.report.excludeEnv).toBe(originalExcludeEnv);
  } finally {
    report.mockRestore();
    await rm(directory, { recursive: true, force: true });
  }
});

it("pins backend versions and architecture while keeping older job and publish manifests readable", async () => {
  await mkdir(resolve(".preview"), { recursive: true });
  const directory = await mkdtemp(resolve(".preview/renderer-identity-"));
  try {
    const project = StoryboardProject.create({ title: "Backend identity", width: 32, height: 32 });
    const panel = project.addScene("S").addShot("S").addPanel({ durationFrames: 2 });
    project.capturePanelAnimation(panel.id, { id: "shot" });
    const source = join(directory, "source.cboard"),
      job = join(directory, "job.sqlite");
    await project.save(source);
    const { manifest } = createFrameJob(source, job, {
      expectedVersion: project.version,
      target: { kind: "shot", animationId: "shot" },
    });
    expect(manifest.renderer.backends).toMatchObject({
      architecture: process.arch,
      sharp: { sharp: sharp.versions.sharp, vips: sharp.versions.vips, lcms: sharp.versions.lcms },
    });
    expect(manifest.renderer.backends!.skiaCanvas).toMatch(/^\d+\.\d+\.\d+/);
    expect(manifest.renderer.backends!.nativeFiles!["skia.node"]).toMatch(/^[a-f0-9]{64}$/);
    await runFrameJob(job, { range: { startFrame: 0, endFrame: 1 } });
    const replaceManifest = (value: typeof manifest) => {
      const db = new DatabaseSync(job);
      try {
        db.prepare("UPDATE job SET manifest=? WHERE id=1").run(JSON.stringify(value));
      } finally {
        db.close();
      }
    };
    const reordered = structuredClone(manifest);
    reordered.renderer.backends!.sharp = Object.fromEntries(
      Object.entries(reordered.renderer.backends!.sharp).reverse(),
    );
    replaceManifest(reordered);
    expect(await runFrameJob(job, { range: { startFrame: 0, endFrame: 1 } })).toMatchObject({
      rendered: 0,
      reused: 1,
    });
    for (const difference of ["architecture", "skiaCanvas", "sharp", "binary", "legacy"] as const) {
      const changed = structuredClone(manifest);
      if (difference === "legacy") delete changed.renderer.backends;
      else if (difference === "binary")
        changed.renderer.backends!.nativeFiles!["skia.node"] = "0".repeat(64);
      else if (difference === "sharp") changed.renderer.backends!.sharp.vips = "different-build";
      else changed.renderer.backends![difference] = "different-build";
      replaceManifest(changed);
      expect(inspectFrameJob(job).completed).toBe(1);
      await expect(runFrameJob(job)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
      expect(inspectFrameJob(job).completed).toBe(1);
    }
    replaceManifest(manifest);
    expect(await runFrameJob(job)).toMatchObject({ rendered: 1, reused: 1, complete: true });

    const published = await publishProject(source, join(directory, "published"), {
      expectedVersion: project.version,
    });
    expect((await verifyProjectPublish(published.directory)).runtimeMatches).toBe(true);
    const path = join(published.directory, "manifest.json");
    const saved = JSON.parse(await readFile(path, "utf8"));
    saved.engine.backends.sharp.vips = "different-build";
    await writeFile(path, JSON.stringify(saved));
    expect((await verifyProjectPublish(published.directory)).runtimeMatches).toBe(false);
    delete saved.engine.backends;
    await writeFile(path, JSON.stringify(saved));
    expect((await verifyProjectPublish(published.directory)).runtimeMatches).toBe(false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
