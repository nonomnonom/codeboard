import assert from "node:assert/strict";
import { join } from "node:path";
import { StoryboardProject, ProjectStore, renderFramePNG } from "codeboard-studio";
import { motion } from "../../shared/motion.ts";
import { comparison, report } from "../../shared/artifacts.ts";
import { save } from "../../shared.ts";

export async function generate(output: string): Promise<void> {
  const { project, moving, panel } = motion("Saved revision and restore");
  project.configure({ frameRate: { value: 48, timing: "preserve-seconds" } });
  assert.equal(project.toJSON().panels[0]!.durationFrames, 48);
  const file = join(output, "saved-revision.cboard");
  await project.save(file);
  {
    const store = ProjectStore.open(file);
    try {
      store.saveRevision("base", { expectedVersion: project.version });
    } finally {
      store.close();
    }
  }
  const initial = await renderFramePNG(project, 24);
  const stale = await StoryboardProject.open(file);
  const stalePlan = stale.plan("Stale caption", [
    { op: "panel.revise", id: panel.id, changes: { notes: "Stale writer" } },
  ]);
  const plan = project.plan("Reduce opacity", [
    { op: "layer.set", panelId: panel.id, id: moving.id, changes: { opacity: 0.25 } },
  ]);
  const first = await project.commit(plan, { requestId: "opacity-pass" });
  const opened = await StoryboardProject.open(file);
  assert.deepEqual(await opened.commit(plan, { requestId: "opacity-pass" }), {
    ...first,
    replayed: true,
  });
  await assert.rejects(stale.commit(stalePlan, { requestId: "stale-caption" }), {
    code: "REVISION_CONFLICT",
  });
  const revised = await renderFramePNG(opened, 24);
  {
    const store = ProjectStore.open(file);
    try {
      store.restoreRevision("base", { expectedVersion: opened.version });
      store.compact();
      store.verify();
    } finally {
      store.close();
    }
  }
  const restored = await StoryboardProject.open(file);
  const restoredPNG = await renderFramePNG(restored, 24);
  assert.deepEqual(restoredPNG, initial);
  await save(
    output,
    "saved-revision",
    restored,
    await comparison(output, "Try a change and return to the original", [
      { label: "Original opaque prop", png: initial },
      { label: "Reduce opacity to 25%", png: revised },
      { label: "Restore the original", png: restoredPNG },
    ]),
  );
  await report(output, "workflow", {
    receipt: first,
    replayed: true,
    staleWriterRejected: true,
    frameRate: restored.toJSON().frameRate,
    query: restored.production.query({ kind: "group", limit: 1 }),
  });
}
