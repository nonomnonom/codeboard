import { expect, it } from "vitest";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  StoryboardProject,
  ProjectStore,
  createPixels,
  renderFramePNG,
} from "../../../src/index.js";

async function worker(source: string, planFile: string, mode = "resume") {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "test/fixtures/project-commit-worker.ts", source, planFile, mode],
    { cwd: resolve("."), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  const closed = once(child, "close");
  let stdout = "",
    stderr = "",
    killed = false;
  const interrupt = mode === "before" || mode === "after";
  child.stderr.on("data", (data) => {
    stderr += data.toString();
  });
  child.stdout.on("data", (data) => {
    stdout += data.toString();
    if (interrupt && stdout.includes("checkpoint\n")) killed = child.kill("SIGKILL");
  });
  const timeout = setTimeout(() => child.kill("SIGKILL"), 20_000);
  try {
    const [code] = await closed;
    if (interrupt) {
      expect(killed).toBe(true);
      expect(code).not.toBe(0);
      return;
    }
    if (code !== 0) throw new Error(`Project worker failed (${code}): ${stderr}`);
    return JSON.parse(stdout);
  } finally {
    clearTimeout(timeout);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
}

async function fixture(directory: string) {
  const project = StoryboardProject.create({ title: "Before", width: 128, height: 128 });
  const panel = project.addScene("Scene").addShot("Shot").addPanel({ durationFrames: 24 });
  const layer = panel.addRasterLayer("Paint");
  const image = createPixels(128, 128);
  const element = layer.rasterSurface(image);
  const source = join(directory, "source.cboard");
  await project.save(source);
  {
    using store = ProjectStore.open(source);
    store.saveRevision("before", { expectedVersion: project.version });
  }
  let state = 42;
  for (let i = 0; i < image.pixels.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    image.pixels[i] = i % 4 === 3 ? 255 : state >>> 24;
  }
  const plan = project.plan("Paint and title", [
    { op: "project.configure", changes: { title: "After" } },
    {
      op: "pixels.patch",
      panelId: panel.id,
      layerId: layer.id,
      id: element,
      region: { x: 0, y: 0, width: 128, height: 128 },
      pixelsBase64: Buffer.from(image.pixels).toString("base64"),
    },
  ]);
  const planFile = join(directory, "plan.json");
  await writeFile(planFile, JSON.stringify(plan));
  const referenceFile = join(directory, "reference.cboard");
  await project.save(referenceFile);
  const reference = await StoryboardProject.open(referenceFile);
  await reference.commit(plan, { requestId: "reference-edit" });
  return { source, planFile, project, reference };
}

for (const mode of ["before", "after", "full"] as const) {
  it(`recovers a project commit at ${mode} without splitting artwork and receipt`, async () => {
    await mkdir(resolve(".preview"), { recursive: true });
    const directory = await mkdtemp(resolve(`.preview/project-recovery-${mode}-`));
    try {
      const { source, planFile, project, reference } = await fixture(directory);
      const result = await worker(source, planFile, mode);
      if (mode === "before") expect((await stat(`${source}-journal`)).size).toBeGreaterThan(512);
      if (mode === "full") expect(result).toMatchObject({ failure: { errcode: 13 } });
      const beforeRetry = await StoryboardProject.open(source);
      const expected = mode === "after" ? reference : project;
      expect(beforeRetry.title).toBe(expected.title);
      expect(beforeRetry.version).toBe(expected.version);
      expect(beforeRetry.toJSON().panels).toEqual(expected.toJSON().panels);
      expect(await renderFramePNG(beforeRetry, 0)).toEqual(await renderFramePNG(expected, 0));
      {
        using store = ProjectStore.open(source);
        store.verify();
        expect(store.readRevision("before")).toEqual(project.toJSON());
        expect(store.readReceipt("recovery-edit") === null).toBe(mode !== "after");
      }
      const resumed = await worker(source, planFile);
      expect(resumed).toMatchObject({
        replayed: mode === "after",
        receipt: { baseVersion: project.version, committedVersion: project.version + 1 },
      });
      expect(await worker(source, planFile)).toEqual({ ...resumed, replayed: true });
      const restored = await StoryboardProject.open(source);
      expect(restored.version).toBe(project.version + 1);
      expect(restored.toJSON().panels).toEqual(reference.toJSON().panels);
      expect(await renderFramePNG(restored, 0)).toEqual(await renderFramePNG(reference, 0));
      const db = new DatabaseSync(source);
      try {
        expect(db.prepare("PRAGMA integrity_check").get()!.integrity_check).toBe("ok");
        expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      } finally {
        db.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 60_000);
}
