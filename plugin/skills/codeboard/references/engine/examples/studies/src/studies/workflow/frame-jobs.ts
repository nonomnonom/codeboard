import assert from "node:assert/strict";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import {
  createFrameJob,
  runFrameJob,
  inspectFrameJob,
  readFrameJobFrame,
  exportFrameJobSequence,
  verifyFrameSequence,
  renderShotFramePNG,
  type ShotCompositeGraph,
  StoryboardProject,
} from "codeboard-studio";
import { motion } from "../../shared/motion.ts";
import { sheet, report } from "../../shared/artifacts.ts";
import { retimeGraphShot } from "./shot-retime.ts";

export async function render(output: string): Promise<void> {
  const { project } = motion("Resume a frame job", 12);
  const moving = project
    .shotAnimation("animation:study")
    .layers.find((layer) => layer.name === "Moving prop");
  if (!moving) throw new Error("Motion study requires its captured moving group");
  project.editShotAnimation("animation:study", [
    {
      op: "layer.set",
      layerId: moving.id,
      changes: {
        effects: [
          { kind: "saturation", amount: 1 },
          {
            kind: "shadow",
            amount: 4,
            offsetX: 12,
            offsetY: 10,
            color: { r: 20, g: 24, b: 32 },
            opacity: 0.6,
          },
        ],
      },
    },
    ...moving.keyframes.map((key) => ({
      op: "layer.key.put" as const,
      layerId: moving.id,
      key: {
        ...key,
        effectValues: [
          { index: 0, value: key.frame === 0 ? 0 : 1, easing: "ease-in-out" as const },
          { index: 1, value: key.frame === 0 ? 2 : 6 },
          { index: 1, channel: "offsetX" as const, value: key.frame === 0 ? -16 : 16 },
          { index: 1, channel: "offsetY" as const, value: key.frame === 0 ? 4 : 12 },
          { index: 1, channel: "opacity" as const, value: key.frame === 0 ? 0.2 : 0.7 },
        ],
      },
    })),
  ]);
  const source = join(output, "frame-jobs.cboard"),
    job = join(output, "frames.sqlite");
  await project.save(source);
  createFrameJob(source, job, {
    expectedVersion: project.version,
    target: { kind: "shot", animationId: "animation:study" },
  });
  const controller = new AbortController();
  await assert.rejects(
    runFrameJob(job, {
      signal: controller.signal,
      onProgress(completed) {
        if (completed === 4) controller.abort();
      },
    }),
  );
  const interrupted = inspectFrameJob(job);
  assert.equal(interrupted.completed, 4);
  const resumed = await runFrameJob(job);
  assert.equal(resumed.reused, 4);
  assert.equal(resumed.rendered, 8);
  for (const frame of [0, 3, 11])
    assert.deepEqual(
      readFrameJobFrame(job, frame),
      await renderShotFramePNG(project.shotAnimation("animation:study"), frame),
    );
  const reviewJob = join(output, "review.sqlite");
  createFrameJob(source, reviewJob, {
    expectedVersion: project.version,
    target: { kind: "shot", animationId: "animation:study" },
    outputProfile: {
      width: 320,
      height: 180,
      fit: "contain",
      alpha: "flatten",
      background: { r: 24, g: 24, b: 24 },
    },
  });
  const review = await runFrameJob(reviewJob);
  const propJob = join(output, "prop-pass.sqlite");
  createFrameJob(source, propJob, {
    expectedVersion: project.version,
    target: {
      kind: "shot",
      animationId: "animation:study",
      render: { layerIds: [moving.id], background: "transparent" },
    },
  });
  const prop = await runFrameJob(propJob);
  const propSequence = await exportFrameJobSequence(propJob, join(output, "prop-sequence"));
  const verifiedSequence = await verifyFrameSequence(propSequence.directory, { decode: true });
  await writeFile(join(output, "prop-pass.png"), readFrameJobFrame(propJob, 11));
  const ground = project
    .shotAnimation("animation:study")
    .layers.find((layer) => layer.name === "Ground");
  if (!ground) throw new Error("Motion study requires its captured ground layer");
  const compositing: ShotCompositeGraph = {
    nodes: [
      { id: "ground", kind: "source", layerIds: [ground.id] },
      { id: "prop", kind: "source", layerIds: [moving.id] },
      {
        id: "grade",
        kind: "effects",
        input: "prop",
        effects: [{ kind: "brightness", amount: 1.2 }],
        keyframes: [
          { frame: 0, easing: "ease-in-out", effectValues: [{ index: 0, value: 0.6 }] },
          { frame: 11, easing: "linear", effectValues: [{ index: 0, value: 1.2 }] },
        ],
      },
      { id: "matte", kind: "mask", input: "grade", mask: "prop", mode: "in" },
      {
        id: "combined",
        kind: "blend",
        background: "ground",
        foreground: "matte",
        mode: "source-over",
        opacity: 1,
        keyframes: [
          { frame: 0, easing: "linear", opacity: 0.25 },
          { frame: 11, easing: "linear", opacity: 1 },
        ],
      },
    ],
    output: "combined",
  };
  await writeFile(join(output, "compositing.json"), JSON.stringify(compositing, null, 2));
  const compositeJob = join(output, "composite.sqlite");
  createFrameJob(source, compositeJob, {
    expectedVersion: project.version,
    target: { kind: "shot", animationId: "animation:study", render: { compositing } },
    range: { startFrame: 0, endFrame: 12 },
  });
  const composite = await runFrameJob(compositeJob);
  for (const frame of [11, 0, 5])
    assert.deepEqual(
      readFrameJobFrame(compositeJob, frame),
      await renderShotFramePNG(project.shotAnimation("animation:study"), frame, { compositing }),
    );
  const attachedPath = join(output, "composited-shot.cboard");
  const attached = await StoryboardProject.open(source);
  attached.putEditorialSequence({
    id: "edit:composited",
    frameRate: attached.shotAnimation("animation:study").frameRate,
    clips: [
      {
        id: "clip:composited",
        animationId: "animation:study",
        startFrame: 0,
        sourceInFrame: 0,
        durationFrames: 12,
        transition: { type: "cut", durationFrames: 0 },
      },
    ],
  });
  await attached.save(attachedPath);
  const graphPlan = attached.plan("Attach shot compositing", [
    {
      op: "animation.edit",
      id: "animation:study",
      edits: [{ op: "compositing.set", graph: compositing }],
    },
  ]);
  const graphCommit = await attached.commit(graphPlan, { requestId: "attach-compositing" });
  const reopened = await StoryboardProject.open(attachedPath);
  const editorialJob = join(output, "composited-editorial.sqlite");
  createFrameJob(attachedPath, editorialJob, {
    expectedVersion: reopened.version,
    target: { kind: "editorial", sequenceId: "edit:composited" },
    range: { startFrame: 0, endFrame: 12 },
  });
  const editorial = await runFrameJob(editorialJob);
  for (const frame of [11, 0, 5])
    assert.deepEqual(
      readFrameJobFrame(editorialJob, frame),
      readFrameJobFrame(compositeJob, frame),
    );
  const png = await sheet("Resumed frame job", [
    { label: "Frame 0 · reused", png: readFrameJobFrame(job, 0) },
    { label: "Frame 3 · reused", png: readFrameJobFrame(job, 3) },
    { label: "Frame 11 · rendered after resume", png: readFrameJobFrame(job, 11) },
    { label: "Frame 11 · 320 × 180 review", png: readFrameJobFrame(reviewJob, 11) },
    { label: "Frame 11 · composite graph", png: readFrameJobFrame(compositeJob, 11) },
    { label: "Frame 0 · animated graph", png: readFrameJobFrame(compositeJob, 0) },
    { label: "Frame 5 · animated graph", png: readFrameJobFrame(compositeJob, 5) },
  ]);
  // Keep the job's pinned source version unchanged after completion.
  await writeFile(join(output, "frame-jobs.png"), png);
  const retime = await retimeGraphShot(output, attachedPath);
  await report(output, "progress", {
    retime,
    prop,
    composite,
    editorial,
    graphReceipt: graphCommit.receipt,
    editorialJob: inspectFrameJob(editorialJob),
    compositeJob: inspectFrameJob(compositeJob),
    propSequence,
    verifiedSequence,
    propJob: inspectFrameJob(propJob),
    interrupted,
    resumed,
    review,
    reviewJob: inspectFrameJob(reviewJob),
  });
}
