import assert from "node:assert/strict";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import {
  pathCommands,
  planShotLipSync,
  renderShotFramePNG,
  evaluateDrawing,
  rescaleLipSync,
  StoryboardProject,
} from "codeboard-studio";
import { amber, ink, make, rect, save } from "../../shared.ts";
import { sheet, comparison, report } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Editable mouth cues");
  const panel = project.addScene("Study").addShot("Mouth mapping").addPanel({ durationFrames: 24 });
  const face = panel.addVectorLayer("Face");
  rect(face, 90, 30, 180, 210, amber);
  rect(face, 130, 90, 12, 12, ink);
  rect(face, 218, 90, 12, 12, ink);
  const mouth = panel.addGroup("Mouth drawings");
  const rest = panel.addVectorLayer("Rest", {}, mouth.id);
  rect(rest, 140, 175, 80, 4, ink);
  const open = panel.addVectorLayer("Open", {}, mouth.id);
  open.path(pathCommands("M140 155 Q180 135 220 155 L210 195 Q180 215 150 195 Z"), { fill: ink });
  project.production.setDrawingSequence(mouth.id, [{ frame: 0, drawingId: rest.id }]);
  const capture = project.capturePanelAnimation(panel.id, { id: "animation:mouth" });
  const mapped = (id: string) =>
    capture.identities.find((entry) => entry.sourceId === id)!.capturedId;
  await project.save(join(output, "lip-sync.cboard"));
  const cues = [{ startFrame: 4, endFrame: 18, mouth: "A" }];
  const corrections = [{ startFrame: 10, endFrame: 13, drawingId: mapped(rest.id) }];
  await project.commit(
    planShotLipSync(project, "animation:mouth", mapped(mouth.id), {
      startFrame: 0,
      endFrame: 24,
      mouths: { A: mapped(open.id) },
      restDrawingId: mapped(rest.id),
      cues,
      corrections,
    }),
    { requestId: "mouth-correction" },
  );
  const animation = project.shotAnimation("animation:mouth");
  const group = animation.layers.find((layer) => layer.id === mapped(mouth.id))!;
  assert.equal(group.kind, "group");
  if (group.kind !== "group") throw new Error("Expected drawing group");
  assert.equal(evaluateDrawing(group.drawingSequence, 10), mapped(rest.id));
  const frames = [0, 4, 10, 13, 18, 23];
  await save(
    output,
    "lip-sync",
    project,
    await comparison(
      output,
      "Hold a mouth shape, then correct it",
      await Promise.all(
        frames.map(async (frame) => ({
          label: `Frame ${frame}: ${frame === 10 ? "manual closure" : frame === 4 || frame === 13 ? "mouth open" : "mouth at rest"}`,
          png: await renderShotFramePNG(animation, frame),
        })),
      ),
    ),
  );
  const revised = rescaleLipSync(
    {
      startFrame: 0,
      endFrame: 24,
      mouths: { A: mapped(open.id) },
      restDrawingId: mapped(rest.id),
      cues: [{ startFrame: 3, endFrame: 20, mouth: "A" }],
      corrections,
    },
    {
      sourceRate: { numerator: 24, denominator: 1 },
      targetRate: { numerator: 48, denominator: 1 },
    },
  );
  await writeFile(
    join(output, "lip-sync-source.json"),
    JSON.stringify(
      {
        frameRate: { numerator: 48, denominator: 1 },
        options: revised.options,
      },
      null,
      2,
    ),
  );
  const revisedPath = join(output, "lip-sync-reanalyzed.cboard");
  const reanalyzed = await StoryboardProject.open(join(output, "lip-sync.cboard"));
  await reanalyzed.save(revisedPath);
  await reanalyzed.commit(
    reanalyzed.plan("Convert mouth shot to 48 fps", [
      {
        op: "animation.edit",
        id: "animation:mouth",
        edits: [
          {
            op: "timing.retime",
            durationFrames: 48,
            frameRate: { numerator: 48, denominator: 1 },
            audio: "preserve-seconds",
          },
        ],
      },
    ]),
    { requestId: "mouth-duration" },
  );
  const replacement = planShotLipSync(
    reanalyzed,
    "animation:mouth",
    mapped(mouth.id),
    revised.options,
  );
  await writeFile(
    join(output, "lip-sync-reanalysis-plan.json"),
    JSON.stringify(replacement, null, 2),
  );
  const receipt = await reanalyzed.commit(replacement, { requestId: "mouth-reanalysis" });
  const reopened = await StoryboardProject.open(revisedPath);
  const revisedShot = reopened.shotAnimation("animation:mouth");
  const revisedGroup = revisedShot.layers.find((layer) => layer.id === mapped(mouth.id));
  if (revisedGroup?.kind !== "group") throw new Error("Expected revised mouth drawing group");
  assert.equal(evaluateDrawing(revisedGroup.drawingSequence, 20), mapped(rest.id));
  assert.equal(evaluateDrawing(revisedGroup.drawingSequence, 26), mapped(open.id));
  await writeFile(
    join(output, "lip-sync-reanalyzed.png"),
    await sheet("Reanalysis retains manual correction", [
      { label: "Frame 20 · retained correction", png: await renderShotFramePNG(revisedShot, 20) },
      { label: "Frame 26 · revised cue resumes", png: await renderShotFramePNG(revisedShot, 26) },
    ]),
  );
  await report(output, "cues", {
    reanalysis: { timing: revised.report, receipt: receipt.receipt },
    cues,
    corrections,
    keys: group.drawingSequence,
    correctionNeighbors: project.production.drawingNeighbors(mapped(mouth.id), 10),
  });
}
