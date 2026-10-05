import assert from "node:assert/strict";
import {
  renderEditorialFramePNG,
  renderShotFramePNG,
  renderFramePNG,
  rescaleTime,
} from "codeboard-studio";
import { amber, blue, make, rect, save, text } from "../../shared.ts";
import { sheet, report } from "../../shared/artifacts.ts";
import { compareBoardTransition } from "./board-transition.ts";

export async function render(output: string): Promise<void> {
  const project = make("Editorial reorder preserves shot animation");
  const scene = project.addScene("Study");
  const captures = [];
  for (const [index, color] of [amber, blue].entries()) {
    const panel = scene.addShot(`Shot ${index + 1}`).addPanel({ durationFrames: 24 });
    const art = panel.addVectorLayer("Card");
    rect(art, 60, 60, 240, 150, color);
    text(art, `Shot ${index + 1}`, 140, 140, 26);
    project.production.addLayerKeyframe(art.id, index * 24, {
      transform: { x: 0 },
      easing: "linear",
    });
    project.production.addLayerKeyframe(art.id, index * 24 + 23, { transform: { x: 12 } });
    const capture = project.capturePanelAnimation(panel.id, {
      id: `animation:${index}`,
      preRollFrames: 6,
      postRollFrames: 6,
    });
    captures.push(capture);
    for (const local of [0, 11, 23])
      assert.deepEqual(
        await renderShotFramePNG(project.shotAnimation(capture.animationId), local + 6),
        await renderFramePNG(project, index * 24 + local),
      );
  }
  project.putEditorialSequence({
    id: "edit:study",
    frameRate: { numerator: 24, denominator: 1 },
    clips: [0, 1].map((index) => ({
      id: `clip:${index}`,
      animationId: `animation:${index}`,
      startFrame: index * 24,
      sourceInFrame: 6,
      durationFrames: 24,
      transition: { type: "cut", durationFrames: 0 },
    })),
  });
  const samples = [];
  for (const frame of [0, 24])
    samples.push({
      label: `Before · edit frame ${frame}`,
      png: await renderEditorialFramePNG(
        project.editorialSequence("edit:study"),
        project.studio.animations,
        frame,
      ),
    });
  const source = project.shotAnimation("animation:0");
  project.editEditorial("edit:study", [
    { op: "move", id: "clip:1", beforeId: "clip:0" },
    { op: "update", id: "clip:0", changes: { sourceInFrame: 12, durationFrames: 18 } },
  ]);
  assert.deepEqual(project.shotAnimation("animation:0"), source);
  assert.deepEqual(
    await renderShotFramePNG(source, 12),
    await renderEditorialFramePNG(
      project.editorialSequence("edit:study"),
      project.studio.animations,
      24,
    ),
  );
  for (const frame of [0, 24])
    samples.push({
      label: `After · edit frame ${frame}`,
      png: await renderEditorialFramePNG(
        project.editorialSequence("edit:study"),
        project.studio.animations,
        frame,
      ),
    });
  const transition = await compareBoardTransition(project, captures[0]!.source.panelId, output);
  samples.push(...transition.frames);
  await save(
    output,
    "editorial-cuts",
    project,
    await sheet("Editorial reorder and board transition", samples, 2),
  );
  await report(output, "edit", {
    captures,
    heldTransition: transition.sequence,
    heldSplit: transition.split,
    capturedBoard: transition.capturedBoard,
    clips: project.editorialClips("edit:study"),
    oneSecondAt30fps: rescaleTime(24, 24, 30, "exact"),
  });
}
