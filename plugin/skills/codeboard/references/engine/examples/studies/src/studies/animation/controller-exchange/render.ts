import assert from "node:assert/strict";
import { join } from "node:path";
import { StoryboardProject, createShotRenderSession, renderShotFramePNG } from "codeboard-studio";
import { sheet, report } from "../../../shared/artifacts.ts";
import { save } from "../../../shared.ts";
import { author } from "./author.ts";
import { addDialogue, verifyPerformance } from "./performance.ts";
import { bindArms } from "./deformation.ts";

export async function render(output: string): Promise<void> {
  const { project, shots } = author();
  const file = join(output, "controller-exchange.cboard");
  await project.save(file);
  const plan = project.plan(
    "Stage two characters with named controllers",
    shots.map((shot) => ({
      op: "animation.edit",
      id: shot.animationId,
      edits: shot.controllers.map((controller) => ({ op: "controller.put", controller })),
    })),
  );
  const committed = await project.commit(plan, { requestId: "controllers:exchange" });
  let reopened = await StoryboardProject.open(file);
  assert.equal((await reopened.commit(plan, { requestId: "controllers:exchange" })).replayed, true);
  for (const shot of shots)
    assert.deepEqual(reopened.shotAnimation(shot.animationId).layers, shot.baseLayers);
  const dialogue = await addDialogue(reopened, shots);
  const deformation = await bindArms(reopened, shots);
  const beforePalette = await Promise.all(
    shots.map((shot) => renderShotFramePNG(reopened.shotAnimation(shot.animationId), 12)),
  );
  const palettePlan = reopened.plan("Revise shared clothing colors", [
    {
      op: "palette.put",
      palette: {
        id: "palette:exchange",
        name: "Character clothes",
        swatches: [
          { id: "swatch:sender", name: "Sender", color: "#557c67" },
          { id: "swatch:receiver", name: "Receiver", color: "#b46c5a" },
        ],
      },
    },
  ]);
  const paletteReceipt = await reopened.commit(palettePlan, { requestId: "exchange:palette" });
  reopened = await StoryboardProject.open(file);
  assert.equal(
    (await reopened.commit(deformation.plan, { requestId: deformation.requestId })).replayed,
    true,
  );
  for (const entry of dialogue)
    assert.equal(
      (await reopened.commit(entry.plan, { requestId: entry.requestId })).replayed,
      true,
    );
  assert.equal(
    (await reopened.commit(palettePlan, { requestId: "exchange:palette" })).replayed,
    true,
  );
  verifyPerformance(reopened, shots);
  for (const binding of deformation.bindings)
    assert.deepEqual(reopened.shotAnimation(binding.animationId).meshes, binding.arms);
  const samples = [];
  for (const [index, shot] of shots.entries()) {
    const animation = reopened.shotAnimation(shot.animationId),
      session = createShotRenderSession(animation);
    assert.notDeepEqual(await session.png(12), beforePalette[index]);
    for (const frame of [23, 3, 12, 0, 3])
      assert.deepEqual(await session.png(frame), await renderShotFramePNG(animation, frame));
    samples.push({ label: shot.name, png: await session.png(12) });
  }
  await save(
    output,
    "controller-exchange",
    reopened,
    await sheet("Controller performance across four shots", samples, 2),
  );
  await report(output, "controllers", {
    committed,
    baseKeysPreserved: true,
    backwardSeekParity: true,
    shotIds: shots.map((shot) => shot.animationId),
    frames: 96,
    plan,
    dialogue,
    deformation,
    curveRestPixelParity: true,
    editableCurveControlsPreserved: true,
    paletteReceipt,
    manualMouthCorrection: { startFrame: 10, endFrame: 13 },
    paletteChangedAllShots: true,
    receiverSleeveOverridePreserved: true,
    dialogueSource: "Authored mouth cues; no recorded speech or automatic alignment",
  });
}
