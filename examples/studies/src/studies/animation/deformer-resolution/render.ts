import assert from "node:assert/strict";
import { join } from "node:path";
import { StoryboardProject, createShotRenderSession, renderShotFramePNG } from "codeboard-studio";
import { save } from "../../../shared.ts";
import { comparison, report } from "../../../shared/artifacts.ts";
import { author } from "./author.ts";

export async function generate(output: string): Promise<void> {
  const { project, animationId, layerId, curve } = author();
  const before = await renderShotFramePNG(project.shotAnimation(animationId), 0);
  const file = join(output, "deformer-resolution.cboard");
  await project.save(file);
  const plan = project.plan("Bind a magnified masked ribbon", [
    {
      op: "animation.edit",
      id: animationId,
      edits: [{ op: "layer.curve", layerId, curve }],
    },
  ]);
  const committed = await project.commit(plan, { requestId: "ribbon:bind" });
  const reopened = await StoryboardProject.open(file);
  assert.equal((await reopened.commit(plan, { requestId: "ribbon:bind" })).replayed, true);
  const animation = reopened.shotAnimation(animationId);
  const session = createShotRenderSession(animation);
  assert.deepEqual(await session.png(0), before);
  for (const frame of [23, 3, 12, 0, 3])
    assert.deepEqual(await session.png(frame), await renderShotFramePNG(animation, frame));
  await save(
    output,
    "deformer-resolution",
    reopened,
    await comparison(output, "Bend the stripes and their boundary", [
      { label: "Start with a straight ribbon", png: await session.png(0) },
      { label: "Halfway through the bend", png: await session.png(12) },
      { label: "Stripes and mask curve together", png: await session.png(23) },
    ]),
  );
  await report(output, "deformation", {
    committed,
    plan,
    identityPNGParity: true,
    backwardSeekParity: true,
    placementScale: 2,
  });
}
