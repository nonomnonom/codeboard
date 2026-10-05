import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  StoryboardProject,
  planShotMerge,
  renderShotFramePNG,
  type ShotAnimation,
} from "codeboard-studio";
import { amber, ink, save } from "../../shared.ts";
import { motion } from "../../shared/motion.ts";
import { sheet, report } from "../../shared/artifacts.ts";

function prop(animation: ShotAnimation) {
  const group = animation.layers.find((layer) => layer.name === "Moving prop");
  assert.ok(group?.kind === "group");
  const drawing = group.children.find((layer) => layer.name === "Prop");
  assert.ok(drawing && drawing.kind !== "group");
  const body = drawing.elements[0];
  assert.ok(body?.kind === "vector-path");
  return { group, body };
}

export async function render(output: string): Promise<void> {
  const { project } = motion("Independent workers and explicit upgrade conflicts");
  const basePath = join(output, "base.cboard");
  await project.save(basePath);
  const baseBytes = await readFile(basePath);
  const base = project.shotAnimation("animation:study");

  const colorWorker = await StoryboardProject.open(basePath);
  const colorPath = join(output, "worker-color.cboard");
  await colorWorker.save(colorPath);
  const color = colorWorker.shotAnimation(base.id);
  prop(color).body.fill = amber;
  colorWorker.putShotAnimation(color);
  await colorWorker.save(colorPath);

  const layoutWorker = await StoryboardProject.open(basePath);
  const layoutPath = join(output, "worker-layout.cboard");
  await layoutWorker.save(layoutPath);
  const layout = layoutWorker.shotAnimation(base.id);
  for (const key of prop(layout).group.keyframes)
    if (key.transform.y !== undefined) key.transform.y -= 60;
  layoutWorker.putShotAnimation(layout);
  await layoutWorker.save(layoutPath);

  const assembled = await StoryboardProject.open(basePath);
  const assembledPath = join(output, "shot-merge.cboard");
  await assembled.save(assembledPath);
  const receipts = [];
  for (const [worker, path] of [
    ["color", colorPath],
    ["layout", layoutPath],
  ] as const) {
    const incoming = (await StoryboardProject.open(path)).shotAnimation(base.id);
    const result = planShotMerge(assembled, base, incoming);
    assert.deepEqual(result.conflicts, []);
    assert.ok(result.plan);
    receipts.push(await assembled.commit(result.plan, { requestId: `merge:${worker}` }));
  }
  const merged = assembled.shotAnimation(base.id);
  assert.equal(prop(merged).body.fill, amber);
  assert.deepEqual(prop(merged).group.keyframes, prop(layout).group.keyframes);

  const corrected = structuredClone(merged);
  prop(corrected).body.fill = "#47745b";
  assembled.putShotAnimation(corrected);
  await assembled.save(assembledPath);
  const upgrade = structuredClone(color);
  prop(upgrade).body.fill = ink;
  prop(upgrade).group.opacity = 0.65;
  const before = assembled.toJSON();
  const blocked = planShotMerge(assembled, color, upgrade);
  assert.equal(blocked.plan, null);
  assert.deepEqual(assembled.toJSON(), before);
  assert.equal(blocked.conflicts.length, 1);
  const conflict = blocked.conflicts[0]!;
  assert.ok(conflict.path.endsWith("/fill"));
  const chosen = planShotMerge(assembled, color, upgrade, {
    resolutions: { [conflict.path]: "local" },
  });
  assert.ok(chosen.plan);
  const committed = await assembled.commit(chosen.plan, { requestId: "upgrade:keep-color" });
  const reopened = await StoryboardProject.open(assembledPath);
  const replayed = await reopened.commit(chosen.plan, { requestId: "upgrade:keep-color" });
  assert.deepEqual(replayed, { ...committed, replayed: true });
  const final = reopened.shotAnimation(base.id);
  assert.equal(prop(final).body.fill, "#47745b");
  assert.equal(prop(final).group.opacity, 0.65);
  assert.deepEqual(await readFile(basePath), baseBytes);
  const samples = [];
  for (const [label, animation] of [
    ["Shared baseline", base],
    ["Color worker", color],
    ["Layout worker", layout],
    ["Merged revisions", merged],
    ["Local color correction", corrected],
    ["Upgrade · keep local color", final],
  ] as const)
    samples.push({ label, png: await renderShotFramePNG(animation, 0) });
  await save(output, "shot-merge", reopened, await sheet("Shot worker merge", samples, 2));
  await report(output, "assembly", {
    receipts,
    conflicts: blocked.conflicts,
    resolved: chosen.conflicts,
    incomingChanges: chosen.incomingChanges,
    retainedLocalChanges: chosen.retainedLocalChanges,
    committed,
    replayed,
  });
}
