import type { StoryboardProject } from "../project.js";
import { mergeShotAnimation, type ShotMergeOptions } from "../../animation/shot-merge.js";
import { collectShotDependencies, type ShotDependency } from "../../model/shot-dependencies.js";
import { fingerprint } from "../../model/value-fingerprint.js";
import { boundQueryResponse } from "../../model/query.js";
import { CodeboardError } from "../../model/errors.js";
import { planShotAnimation } from "../edit-plan/studio.js";
import { isDeepStrictEqual } from "node:util";

/** Check native handoff provenance and resource compatibility before preparing a worker merge. */
export function planShotHandoffMerge(
  assembly: StoryboardProject,
  baseline: StoryboardProject,
  worker: StoryboardProject,
  options: ShotMergeOptions & { animationId: string },
) {
  const { animationId, ...mergeOptions } = options;
  const baseDocument = baseline.toJSON(),
    workerDocument = worker.toJSON();
  const metadata = workerDocument.metadata;
  if (
    assembly.id !== baseline.id ||
    metadata["shotSubset.sourceProjectId"] !== baseline.id ||
    metadata["shotSubset.sourceVersion"] !== String(baseline.version) ||
    metadata["shotSubset.animationId"] !== animationId ||
    metadata["shotSubset.sourceDocumentHash"] !== fingerprint(baseDocument)
  )
    throw new CodeboardError(
      "REVISION_CONFLICT",
      "Handoff does not match the supplied source baseline",
      {
        details: { reason: "SHOT_HANDOFF_BASE", animationId },
      },
    );
  const base = baseline.shotAnimation(animationId);
  const incoming = worker.shotAnimation(animationId);
  if (incoming.boardPanelIds?.length)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Handoff board links must be reconciled in the assembly",
    );
  // Export deliberately omits board links; that omission is not a worker edit.
  if (base.boardPanelIds === undefined) delete incoming.boardPanelIds;
  else incoming.boardPanelIds = [...base.boardPanelIds];
  const { animation, ...mergeReport } = mergeShotAnimation(
    base,
    assembly.shotAnimation(animationId),
    incoming,
    mergeOptions,
  );
  const candidateDocument = assembly.toJSON();
  if (animation)
    candidateDocument.studio.animations = candidateDocument.studio.animations.map((entry) =>
      entry.id === animationId ? animation : entry,
    );
  const incomingDependencies = collectShotDependencies(workerDocument, animationId);
  const localDependencies = collectShotDependencies(candidateDocument, animationId);
  const baselineDependencies = collectShotDependencies(baseDocument, animationId);
  const key = (entry: ShotDependency) => `${entry.kind}:${entry.id}`;
  const local = new Map(localDependencies.items.map((entry) => [key(entry), entry]));
  const original = new Map(baselineDependencies.items.map((entry) => [key(entry), entry]));
  const dependencyConflicts = incomingDependencies.items.flatMap((entry) => {
    const current = local.get(key(entry));
    return entry.status !== "missing" && current && isDeepStrictEqual(current, entry)
      ? []
      : [
          {
            kind: entry.kind,
            id: entry.id,
            baseline: original.get(key(entry)) ?? null,
            local: current ?? null,
            incoming: entry,
          },
        ];
  });
  const report = boundQueryResponse(
    {
      ...mergeReport,
      dependencyConflicts,
      source: { projectId: baseline.id, version: baseline.version },
      worker: { projectId: worker.id, version: worker.version },
    },
    "Shot handoff merge report",
  );
  const plan =
    animation && !dependencyConflicts.length && report.incomingChanges.length
      ? assembly.plan("Merge isolated shot handoff", [
          { op: "animation.put", animation: planShotAnimation(animation) },
        ])
      : null;
  return { ...report, plan };
}
