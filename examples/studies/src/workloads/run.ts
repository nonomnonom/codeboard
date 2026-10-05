import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { cpus, platform, release, totalmem } from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  capabilities,
  createFrameJob,
  runFrameJob,
  inspectFrameJob,
  verifyFrameJob,
  readFrameJobFrame,
  renderShotFramePNG,
  exportFrameJobMovie,
  type Layer,
} from "codeboard-studio";
import { prepare } from "./prepare.ts";

const [destination, ...extra] = process.argv.slice(2);
if (!destination || extra.length) throw new Error("Usage: workload <new-output-directory>");
const environment = await capabilities({ probeDependencies: true });
if (
  environment.dependencies.ffmpeg.status !== "available" ||
  environment.dependencies.ffprobe.status !== "available"
)
  throw new Error("Workload requires FFmpeg and ffprobe");
const output = resolve(destination);
await mkdir(output);
const timings: Record<string, number> = {};
async function measured<T>(name: string, work: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await work();
  timings[name] = performance.now() - start;
  console.log(`${name}: ${timings[name].toFixed(1)} ms`);
  return result;
}
const { project, source, shots } = await measured("authorSaveReopen", () => prepare(output));
assert.equal(shots.length, 24);
const frames = 4320;
const job = join(output, "frames.sqlite");
const { manifest } = createFrameJob(source, job, {
  expectedVersion: project.version,
  target: { kind: "editorial", sequenceId: "edit:exchange" },
  fontPolicy: "require-available",
});
assert.equal(manifest.range.endFrame, frames);
const abort = new AbortController();
await measured("firstTwoShots", async () => {
  await assert.rejects(
    runFrameJob(job, {
      signal: abort.signal,
      onProgress(completed) {
        if (completed === 360) abort.abort();
      },
    }),
    { name: "AbortError" },
  );
});
assert.equal(inspectFrameJob(job).completed, 360);
const resumed = await measured("resumeRemainingFrames", () =>
  runFrameJob(job, {
    onProgress(completed) {
      if (completed % 360 === 0) console.log(`Frame ${completed}/${frames}`);
    },
  }),
);
assert.equal(resumed.reused, 360);
assert.equal(resumed.rendered, frames - 360);
const verified = await measured("verifyAllHashes", () => verifyFrameJob(job));
assert.equal(verified.verified, frames);
const pngHash = createHash("sha256");
await measured("compareShotSamples", async () => {
  for (const [index, shot] of shots.entries()) {
    for (const local of [0, 90, 179])
      assert.deepEqual(
        readFrameJobFrame(job, index * 180 + local),
        await renderShotFramePNG(project.shotAnimation(shot.animationId), local),
      );
  }
  for (let frame = 0; frame < frames; frame++) {
    const bytes = readFrameJobFrame(job, frame);
    pngHash.update(`${frame}:${bytes.length}:`).update(bytes);
  }
});
const retried = await measured("reuseCompletedFrames", () => runFrameJob(job));
assert.equal(retried.rendered, 0);
assert.equal(retried.reused, frames);
const movie = join(output, "workload.mp4");
await measured("encodeStoredFrames", () => exportFrameJobMovie(job, movie, { audio: "omit" }));
const probe = spawnSync(
  process.env.FFPROBE_PATH ?? "ffprobe",
  ["-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", movie],
  { encoding: "utf8", windowsHide: true },
);
if (probe.error) throw probe.error;
if (probe.status !== 0) throw new Error(probe.stderr);
const decoded = JSON.parse(probe.stdout);
const video = decoded.streams.find(
  (stream: { codec_type: string }) => stream.codec_type === "video",
);
assert.equal(Number(video.nb_read_frames), frames);
assert.equal(video.avg_frame_rate, "24/1");
assert.equal(Number(video.duration), 180);
let layers = 0,
  elements = 0;
const count = (items: Layer[]) => {
  for (const layer of items) {
    layers++;
    if (layer.kind === "group") count(layer.children);
    else elements += layer.elements.length;
  }
};
for (const shot of project.studio.animations) count(shot.layers);
const report = {
  format: "codeboard-workload/1",
  environment,
  hardware: {
    platform: platform(),
    release: release(),
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    memoryBytes: totalmem(),
  },
  workload: {
    shots: 24,
    frames,
    seconds: 180,
    width: video.width,
    height: video.height,
    layers,
    elements,
    audio: "omitted",
    construction:
      "Six independently captured repetitions of the four-stage exchange; authored cues occupy the first second of speaking shots",
  },
  timings,
  renderedFps: frames / ((timings.firstTwoShots! + timings.resumeRemainingFrames!) / 1000),
  processPeakRssBytes: process.resourceUsage().maxRSS * 1024,
  peakRssScope: "Node process only; excludes encoder child and OS filesystem cache",
  manifest,
  resumed,
  verified,
  retried,
  decoded,
  hashes: {
    pngSequence: pngHash.digest("hex"),
    source: createHash("sha256")
      .update(await readFile(source))
      .digest("hex"),
    movie: createHash("sha256")
      .update(await readFile(movie))
      .digest("hex"),
  },
  qualification:
    "Preview-resolution picture workload with cooperative interruption; not full M6 production, audio, clean-machine or artistic acceptance",
};
await writeFile(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`, {
  flag: "wx",
});
console.log(`Verified workload: ${output}`);
