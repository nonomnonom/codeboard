import assert from "node:assert/strict";
import { writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  StoryboardProject,
  ProjectStore,
  publishProject,
  verifyProjectPublish,
  renderShotFramePNG,
  createToneWav,
} from "codeboard-studio";
import { motion } from "../../shared/motion.ts";
import { comparison, report } from "../../shared/artifacts.ts";
import { save } from "../../shared.ts";

export async function generate(output: string): Promise<void> {
  const { project, panel } = motion("Pinned publish survives source relocation");
  const source = join(output, "source.cboard"),
    tonePath = join(output, "tone.wav");
  const tone = createToneWav({ durationSeconds: 0.25 });
  await writeFile(tonePath, tone);
  const assetId = project.production.addAsset({
    kind: "audio",
    name: "Embedded tone",
    path: "tone.wav",
    mimeType: "audio/wav",
    source: "managed",
    checksum: createHash("sha256").update(tone).digest("hex"),
  });
  await project.save(source);
  {
    const store = ProjectStore.open(source);
    try {
      store.saveRevision("baseline", { expectedVersion: project.version });
    } finally {
      store.close();
    }
  }
  const plan = project.plan("Publish note", [
    { op: "panel.revise", id: panel.id, changes: { notes: "Published snapshot" } },
  ]);
  const committed = await project.commit(plan, { requestId: "publish:caption" });
  const before = await renderShotFramePNG(project.shotAnimation("animation:study"), 12);
  const published = await publishProject(source, join(output, "published"), {
    expectedVersion: project.version,
  });
  await rename(source, join(output, "retired-source.cboard"));
  await rename(tonePath, join(output, "retired-tone.wav"));
  const verified = await verifyProjectPublish(published.directory, {
    expectedManifestHash: published.manifestHash,
  });
  assert.ok(verified.runtimeMatches);
  {
    const store = ProjectStore.open(verified.projectFile);
    try {
      assert.deepEqual(store.readAsset(assetId), tone);
      assert.deepEqual(store.readReceipt("publish:caption"), committed.receipt);
      assert.equal(store.readRevision("baseline").panels[0]!.notes, "");
    } finally {
      store.close();
    }
  }
  const working = await StoryboardProject.open(verified.projectFile);
  const copied = await renderShotFramePNG(working.shotAnimation("animation:study"), 12);
  assert.deepEqual(copied, before);
  const destination = join(output, "project-publish.cboard");
  await working.save(destination);
  const animation = working.shotAnimation("animation:study");
  const prop = animation.layers.find((layer) => layer.name === "Moving prop");
  assert.ok(prop);
  const revision = working.plan("Revise a working copy", [
    {
      op: "animation.edit",
      id: animation.id,
      edits: [{ op: "layer.set", layerId: prop.id, changes: { opacity: 0.45 } }],
    },
  ]);
  await working.commit(revision, { requestId: "resume:opacity" });
  const revised = await renderShotFramePNG(working.shotAnimation(animation.id), 12);
  const after = await verifyProjectPublish(published.directory, {
    expectedManifestHash: published.manifestHash,
  });
  assert.equal(after.manifest.file.sha256, published.manifest.file.sha256);
  await save(
    output,
    "project-publish",
    working,
    await comparison(output, "Hand off a project with its assets", [
      { label: "Published source", png: before },
      { label: "Source paths unavailable", png: copied },
      { label: "Separate working copy revised", png: revised },
    ]),
  );
  await report(output, "publish", {
    manifest: published.manifest,
    manifestHash: published.manifestHash,
    runtimeMatches: verified.runtimeMatches,
    retainedReceipt: committed.receipt,
    publishedFileUnchanged: true,
  });
}
