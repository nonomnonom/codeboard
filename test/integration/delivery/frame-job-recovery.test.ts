import { expect, it } from "vitest";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { copyFile, mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  StoryboardProject,
  createFrameJob,
  inspectFrameJob,
  readFrameJobFrame,
  renderShotFramePNG,
  runFrameJob,
  createPixels,
} from "../../../src/index.js";

async function worker(job: string, pauseAt?: number | "transaction", sourcePath?: string) {
  const child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      "test/fixtures/frame-job-worker.ts",
      job,
      String(pauseAt ?? ""),
      ...(sourcePath ? [sourcePath] : []),
    ],
    { cwd: resolve("."), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let stdout = "",
    stderr = "";
  const closed = once(child, "close");
  child.stderr.on("data", (data) => {
    stderr += data.toString();
  });
  let killed = false;
  child.stdout.on("data", (data) => {
    stdout += data.toString();
    if (pauseAt !== undefined && stdout.includes("checkpoint\n")) {
      killed = child.kill("SIGKILL");
    }
  });
  const timeout = setTimeout(() => child.kill("SIGKILL"), 20_000);
  try {
    const [code] = await closed;
    if (pauseAt !== undefined) {
      expect(killed).toBe(true);
      expect(code).not.toBe(0);
      return;
    }
    if (code !== 0) throw new Error(`Worker failed (${code}): ${stderr}`);
    return JSON.parse(stdout);
  } finally {
    clearTimeout(timeout);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
}

it("resumes a force-killed worker in a new process without mixing source revisions", async () => {
  await mkdir(resolve(".preview"), { recursive: true });
  const directory = await mkdtemp(resolve(".preview/frame-job-recovery-"));
  try {
    const project = StoryboardProject.create({
      title: "Worker recovery",
      width: 64,
      height: 64,
      frameRate: 24,
    });
    const panel = project.addScene("Scene").addShot("Shot").addPanel({ durationFrames: 12 });
    const layer = panel.addVectorLayer("Moving triangle");
    layer.path(
      [{ op: "M", x: 4, y: 4 }, { op: "L", x: 20, y: 4 }, { op: "L", x: 4, y: 20 }, { op: "Z" }],
      { fill: "#de5138" },
    );
    project.production.addLayerKeyframe(layer.id, 0, { transform: { x: 0 } });
    project.production.addLayerKeyframe(layer.id, 11, { transform: { x: 32 } });
    project.capturePanelAnimation(panel.id, { id: "recovery-shot" });
    const source = join(directory, "source.cboard"),
      pinned = join(directory, "pinned.cboard"),
      job = join(directory, "job.sqlite");
    await project.save(source);
    await copyFile(source, pinned);
    const animation = project.shotAnimation("recovery-shot");
    createFrameJob(source, job, {
      expectedVersion: project.version,
      target: { kind: "shot", animationId: animation.id },
    });

    await worker(job, 4);
    expect(inspectFrameJob(job)).toMatchObject({ completed: 4, total: 12, complete: false });
    const committed = [0, 1, 2, 3].map((frame) => readFrameJobFrame(job, frame));
    expect(() => readFrameJobFrame(job, 4)).toThrow(/not completed/);

    project.addScene("Later revision");
    await project.save(source);
    await expect(runFrameJob(job)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect(inspectFrameJob(job).completed).toBe(4);
    expect(await worker(job, undefined, pinned)).toMatchObject({
      rendered: 8,
      reused: 4,
      complete: true,
    });
    for (let frame = 0; frame < 12; frame++) {
      const png = readFrameJobFrame(job, frame);
      expect(png).toEqual(await renderShotFramePNG(animation, frame));
      if (frame < 4) expect(png).toEqual(committed[frame]);
    }
    expect(await worker(job, undefined, pinned)).toMatchObject({
      rendered: 0,
      reused: 12,
      complete: true,
    });
    await expect(runFrameJob(job)).rejects.toMatchObject({ code: "REVISION_CONFLICT" });

    const db = new DatabaseSync(job);
    try {
      expect(db.prepare("PRAGMA integrity_check").get()!.integrity_check).toBe("ok");
      db.prepare("UPDATE frames SET data=? WHERE frame=2").run(Buffer.from("corrupted"));
    } finally {
      db.close();
    }
    await expect(runFrameJob(job, { sourcePath: pinned })).rejects.toMatchObject({
      code: "ASSET_CHECKSUM_MISMATCH",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);

it("rolls back a killed frame transaction before resuming committed frames", async () => {
  await mkdir(resolve(".preview"), { recursive: true });
  const directory = await mkdtemp(resolve(".preview/frame-job-transaction-"));
  try {
    const project = StoryboardProject.create({
      title: "Transaction recovery",
      width: 128,
      height: 128,
      frameRate: 24,
    });
    const panel = project.addScene("Scene").addShot("Shot").addPanel({ durationFrames: 6 });
    const image = createPixels(128, 128);
    let state = 42;
    for (let i = 0; i < image.pixels.length; i++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      image.pixels[i] = i % 4 === 3 ? 255 : state >>> 24;
    }
    panel.addRasterLayer("Noise").rasterSurface(image);
    project.capturePanelAnimation(panel.id, { id: "transaction-shot" });
    const source = join(directory, "source.cboard"),
      job = join(directory, "job.sqlite");
    await project.save(source);
    createFrameJob(source, job, {
      expectedVersion: project.version,
      target: { kind: "shot", animationId: "transaction-shot" },
    });
    await worker(job, "transaction");
    expect((await stat(`${job}-journal`)).size).toBeGreaterThan(512);
    expect(() => inspectFrameJob(job)).toThrow(
      expect.objectContaining({
        code: "OPERATION_FAILED",
        details: { reason: "FRAME_JOB_RECOVERY_REQUIRED" },
      }),
    );
    expect(await worker(job)).toMatchObject({ rendered: 3, reused: 3, complete: true });
    const expected = await renderShotFramePNG(project.shotAnimation("transaction-shot"), 0);
    for (let frame = 0; frame < 6; frame++) expect(readFrameJobFrame(job, frame)).toEqual(expected);
    const db = new DatabaseSync(job);
    try {
      expect(db.prepare("PRAGMA integrity_check").get()!.integrity_check).toBe("ok");
    } finally {
      db.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);
