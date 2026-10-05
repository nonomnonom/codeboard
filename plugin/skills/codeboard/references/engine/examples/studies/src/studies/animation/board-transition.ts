import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  renderFramePNG,
  renderEditorialFramePNG,
  createEditorialResolver,
  StoryboardProject,
  ProjectStore,
  planBoardCapture,
} from "codeboard-studio";

/** Compare the two keyed, handled sources authored by the editorial-cuts study. */
export async function compareBoardTransition(
  project: StoryboardProject,
  firstPanelId: string,
  output: string,
) {
  project.production.setTransition(firstPanelId, { type: "dissolve", durationFrames: 6 });
  project.putEditorialSequence({
    id: "edit:board-transition",
    frameRate: { numerator: 24, denominator: 1 },
    clips: [
      {
        id: "clip:board-out",
        animationId: "animation:0",
        startFrame: 0,
        sourceInFrame: 6,
        durationFrames: 24,
        transition: { type: "dissolve", durationFrames: 6 },
      },
      {
        id: "clip:board-in",
        animationId: "animation:1",
        startFrame: 18,
        sourceInFrame: 6,
        holdFrames: 6,
        durationFrames: 30,
        transition: { type: "cut", durationFrames: 0 },
      },
    ],
  });
  const sequence = project.editorialSequence("edit:board-transition");
  const frames = [];
  for (const frame of [17, 18, 20, 23, 24, 25, 47]) {
    const png = await renderEditorialFramePNG(sequence, project.studio.animations, frame);
    assert.deepEqual(png, await renderFramePNG(project, frame));
    frames.push({ label: `Board / editorial · ${frame}`, png });
  }
  project.putEditorialSequence({
    id: "edit:held-split",
    frameRate: sequence.frameRate,
    clips: [{ ...sequence.clips[1]!, id: "clip:held-split", startFrame: 0 }],
  });
  const before = createEditorialResolver(
    project.editorialSequence("edit:held-split"),
    project.studio.animations,
  );
  project.editEditorial("edit:held-split", [
    { op: "split", id: "clip:held-split", atFrame: 3, newId: "clip:held-right" },
  ]);
  const after = createEditorialResolver(
    project.editorialSequence("edit:held-split"),
    project.studio.animations,
  );
  for (let frame = 0; frame < before.durationFrames; frame++)
    assert.equal(
      after.resolve(frame).outgoing.sourceFrame,
      before.resolve(frame).outgoing.sourceFrame,
    );
  const file = join(output, "board-capture.cboard");
  await project.save(file);
  const capture = planBoardCapture(project, {
    sequenceId: "edit:captured-board",
    panels: project.boardPanels().map((panel, index) => ({
      panelId: panel.id,
      animationId: `animation:captured-board:${index}`,
      clipId: `clip:captured-board:${index}`,
    })),
    audio: { mode: "omit" },
  });
  await writeFile(join(output, "board-capture-plan.json"), JSON.stringify(capture, null, 2));
  const commit = await project.commit(capture.plan, { requestId: "capture-entire-board" });
  const reopened = await StoryboardProject.open(file);
  const store = ProjectStore.open(file);
  try {
    const stored = store.boardPanels({ limit: 200 }, { expectedVersion: reopened.version });
    assert.equal(stored.indexed, true);
    assert.deepEqual(stored.items, reopened.boardPanels({ limit: 200 }));
    assert.equal(stored.durationFrames, 48);
    assert.equal(stored.panelCount, 2);
    const editorial = store.editorialClips(
      capture.sequenceId,
      { limit: 200 },
      { expectedVersion: reopened.version },
    );
    assert.deepEqual(editorial.items, reopened.editorialClips(capture.sequenceId, { limit: 200 }));
    assert.equal(editorial.clipCount, 2);
    assert.equal(editorial.durationFrames, 48);
    assert.equal(editorial.items[1]!.holdFrames, 6);
  } finally {
    store.close();
  }
  const captured = reopened.editorialSequence(capture.sequenceId);
  assert.equal(createEditorialResolver(captured, reopened.studio.animations).durationFrames, 48);
  for (const frame of [17, 18, 20, 23, 24, 25, 47])
    assert.deepEqual(
      await renderEditorialFramePNG(captured, reopened.studio.animations, frame),
      await renderFramePNG(reopened, frame),
    );
  assert.deepEqual(await reopened.commit(capture.plan, { requestId: "capture-entire-board" }), {
    ...commit,
    replayed: true,
  });
  return {
    frames,
    sequence,
    split: project.editorialSequence("edit:held-split"),
    capturedBoard: { source: capture.source, receipt: commit.receipt, audio: capture.audio },
  };
}
