import assert from "node:assert/strict";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import {
  exportReview,
  verifyReviewExport,
  createReviewDecision,
  verifyReviewDecision,
  StoryboardProject,
  ProjectStore,
  renderOnionSkin,
  renderCompositionGuides,
  renderFramePNG,
  comparePixels,
  decodePixels,
} from "codeboard-studio";
import { motion } from "../../shared/motion.ts";
import { sheet, report } from "../../shared/artifacts.ts";
import { blue, amber, save } from "../../shared.ts";

export async function render(output: string): Promise<void> {
  const { project, panel, moving } = motion("Review actual frames");
  const file = join(output, "review-tools.cboard");
  await project.save(file);
  const reviewed = await exportReview(file, join(output, "review"), {
    target: { kind: "shot", animationId: "animation:study" },
    frames: [0, 12, 23],
    expectedVersion: project.version,
  });
  const clean = await renderFramePNG(project, 12);
  const verifiedReview = await verifyReviewExport(reviewed.directory, { decode: true });
  assert.deepEqual(verifiedReview.manifest, reviewed.manifest);
  assert.equal(verifiedReview.verified, 3);
  assert.equal(verifiedReview.decoded, 3);
  const decision = await createReviewDecision(reviewed.directory, {
    id: "decision:study-technical-check",
    reviewer: { id: "agent:review-study", kind: "agent" },
    outcome: "not-reviewed",
    frames: [],
    criteria: [
      "Package hashes and PNG dimensions were checked; visual assessment remains pending.",
    ],
    notes: "No artistic approval is inferred from this executable study.",
  });
  const decisionFile = join(reviewed.directory, "decision.json");
  await writeFile(decisionFile, JSON.stringify(decision, null, 2), { flag: "wx" });
  const savedDecision = await verifyReviewDecision(
    reviewed.directory,
    JSON.parse(await readFile(decisionFile, "utf8")),
    { source: { projectPath: file } },
  );
  assert.deepEqual(savedDecision.decision, decision);
  assert.equal(savedDecision.source!.documentHash, reviewed.manifest.source.documentHash);
  const changedFile = join(output, "review-changed-source.cboard");
  const changed = await StoryboardProject.open(file);
  await changed.save(changedFile);
  const revisionStore = ProjectStore.open(changedFile);
  try {
    revisionStore.saveRevision("review-source", { expectedVersion: changed.version });
  } finally {
    revisionStore.close();
  }
  await changed.commit(
    changed.plan("Record subsequent source revision", [
      { op: "project.metadata", key: "review-study", value: "Changed after review export" },
    ]),
    { requestId: "review-source-change" },
  );
  await assert.rejects(
    verifyReviewDecision(reviewed.directory, decision, {
      source: { projectPath: changedFile },
    }),
    { code: "REVISION_CONFLICT" },
  );
  const historical = await verifyReviewDecision(reviewed.directory, decision, {
    source: { projectPath: changedFile, revision: "review-source" },
  });
  assert.equal(historical.source!.documentHash, reviewed.manifest.source.documentHash);
  const guides = await renderCompositionGuides(project, panel.id, { frame: 12, safeInset: 0.08 });
  const onion = await renderOnionSkin(project, [
    { panelId: panel.id, frame: 0, layerIds: [moving.id], tint: amber, opacity: 0.4 },
    { panelId: panel.id, frame: 12, layerIds: [moving.id], opacity: 1 },
    { panelId: panel.id, frame: 23, layerIds: [moving.id], tint: blue, opacity: 0.4 },
  ]);
  const comparison = comparePixels(await decodePixels(clean), await decodePixels(guides));
  assert.ok(comparison.changedPixels > 0);
  await save(
    output,
    "review-tools",
    project,
    await sheet("Review tools", [
      { label: "Clean frame 12", png: clean },
      { label: "Composition guides", png: guides },
      { label: "Onion skin: 0 / 12 / 23", png: onion },
    ]),
  );
  await report(output, "review-proof", {
    comparison,
    manifest: reviewed.manifest,
    decision,
    sourceVerification: {
      current: savedDecision.source,
      historical: historical.source,
      staleHeadRejected: true,
    },
    verification: {
      manifestSha256: verifiedReview.manifestSha256,
      verified: verifiedReview.verified,
      decoded: verifiedReview.decoded,
      bytes: verifiedReview.bytes,
    },
  });
}
