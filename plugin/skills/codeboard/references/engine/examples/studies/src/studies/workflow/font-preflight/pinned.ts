import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createFrameJob,
  runFrameJob,
  readFrameJobFrame,
  publishProject,
  verifyProjectPublish,
} from "codeboard-studio";
import { make, ink } from "../../../shared.ts";

export async function pinnedTitle(output: string) {
  const font = await readFile(new URL("../../../fixtures/fonts/dm-sans.woff2", import.meta.url));
  const folder = join(output, "fonts");
  await mkdir(folder);
  await writeFile(join(folder, "dm-sans.woff2"), font);
  await copyFile(
    new URL("../../../fixtures/fonts/LICENSE.md", import.meta.url),
    join(folder, "LICENSE.md"),
  );
  const project = make("Title with pinned font file");
  project
    .addScene("Title")
    .addShot("Title")
    .addPanel({ durationFrames: 2 })
    .addVectorLayer("Title")
    .text("Field notes", 35, 140, { font: '42px "Study DM Sans"', color: ink });
  const panelId = project.toJSON().panels[0]!.id;
  project.capturePanelAnimation(panelId, { id: "animation:pinned-font" });
  const source = join(output, "pinned-font.cboard"),
    job = join(output, "pinned-font.sqlite");
  await project.save(source);
  const fontFiles = [
    {
      family: "Study DM Sans",
      path: "fonts/dm-sans.woff2",
      sha256: createHash("sha256").update(font).digest("hex"),
    },
  ];
  createFrameJob(source, job, {
    expectedVersion: project.version,
    target: { kind: "shot", animationId: "animation:pinned-font" },
    fontPolicy: "require-available",
    fontFiles,
  });
  await runFrameJob(job, { range: { startFrame: 0, endFrame: 1 } });
  await writeFile(join(folder, "dm-sans.woff2"), "changed font");
  await assert.rejects(runFrameJob(job), { code: "ASSET_CHECKSUM_MISMATCH" });
  await writeFile(join(folder, "dm-sans.woff2"), font);
  const resumed = await runFrameJob(job);
  assert.equal(resumed.reused, 1);
  assert.equal(resumed.rendered, 1);
  assert.deepEqual(readFrameJobFrame(job, 0), readFrameJobFrame(job, 1));
  const published = await publishProject(source, join(output, "published-font"), {
    expectedVersion: project.version,
    fontFiles,
  });
  await copyFile(join(folder, "LICENSE.md"), join(published.directory, "fonts", "LICENSE.md"));
  const verified = await verifyProjectPublish(published.directory, {
    expectedManifestHash: published.manifestHash,
  });
  const handoffJob = join(output, "handoff-font.sqlite");
  createFrameJob(verified.projectFile, handoffJob, {
    expectedVersion: project.version,
    target: { kind: "shot", animationId: "animation:pinned-font" },
    fontPolicy: "require-available",
    fontFiles: verified.manifest.fontFiles!,
  });
  const handoff = await runFrameJob(handoffJob);
  assert.deepEqual(readFrameJobFrame(handoffJob, 0), readFrameJobFrame(job, 0));
  return { png: readFrameJobFrame(job, 0), fontFiles, resumed, published, handoff };
}
