import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  StoryboardProject,
  retimeShotAnimation,
  createFrameJob,
  runFrameJob,
  readFrameJobFrame,
  inspectFrameJob,
  renderShotFramePNG,
} from "codeboard-studio";
import { sheet } from "../../shared/artifacts.ts";

/** Continue the graph study on a separate source so existing jobs retain their pinned input. */
export async function retimeGraphShot(output: string, source: string) {
  const project = await StoryboardProject.open(source);
  const original = project.shotAnimation("animation:study");
  const originalSnapshot = structuredClone(original);
  const options = {
    durationFrames: original.durationFrames * 2,
    rounding: "exact" as const,
    audio: "scale-starts" as const,
  };
  const preview = retimeShotAnimation(original, options);
  assert.deepEqual(original, originalSnapshot);
  const file = join(output, "retimed-shot.cboard");
  await project.save(file);
  const plan = project.plan("Double shot duration and extend its cut", [
    {
      op: "animation.edit",
      id: original.id,
      edits: [{ op: "timing.retime", ...options }],
    },
    {
      op: "editorial.edit",
      id: "edit:composited",
      edits: [
        {
          op: "update",
          id: "clip:composited",
          changes: { durationFrames: options.durationFrames },
        },
      ],
    },
  ]);
  await writeFile(join(output, "retime-plan.json"), JSON.stringify(plan, null, 2));
  const committed = await project.commit(plan, { requestId: "double-shot-duration" });
  const reopened = await StoryboardProject.open(file);
  const replayed = await reopened.commit(plan, { requestId: "double-shot-duration" });
  assert.deepEqual(replayed, { ...committed, replayed: true });
  assert.deepEqual(reopened.shotAnimation(original.id), preview.animation);
  assert.equal(
    reopened.editorialSequence("edit:composited").clips[0]!.durationFrames,
    options.durationFrames,
  );
  const job = join(output, "retimed-editorial.sqlite");
  createFrameJob(file, job, {
    expectedVersion: reopened.version,
    target: { kind: "editorial", sequenceId: "edit:composited" },
  });
  const completed = await runFrameJob(job);
  const frames = [];
  for (const frame of [11, 0, 5]) {
    const sourcePNG = await renderShotFramePNG(original, frame);
    const targetPNG = readFrameJobFrame(job, frame * 2);
    assert.deepEqual(targetPNG, sourcePNG);
    assert.deepEqual(targetPNG, await renderShotFramePNG(preview.animation, frame * 2));
    frames.push({ label: `Source ${frame} → retimed ${frame * 2}`, png: targetPNG });
  }
  await writeFile(
    join(output, "shot-retime.png"),
    await sheet("Retimed shot and editorial", frames),
  );
  assert.deepEqual((await StoryboardProject.open(source)).shotAnimation(original.id), original);
  return {
    report: preview.report,
    receipt: committed.receipt,
    replayed: replayed.replayed,
    completed,
    job: inspectFrameJob(job),
    frames: [22, 0, 10],
  };
}
