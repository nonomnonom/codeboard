import type { StoryboardProject } from "../project.js";
import type { ShotAnimation } from "../../model/types/shot.js";
import { mergeShotAnimation, type ShotMergeOptions } from "../../animation/shot-merge.js";
import { planShotAnimation } from "../edit-plan/studio.js";

/** Preview a worker revision against the current shot and prepare its native, version-bound edit plan. */
export function planShotMerge(
  project: StoryboardProject,
  base: ShotAnimation,
  incoming: ShotAnimation,
  options: ShotMergeOptions = {},
) {
  const local = project.shotAnimation(base.id);
  const { animation, ...report } = mergeShotAnimation(base, local, incoming, options);
  const plan =
    animation && report.incomingChanges.length
      ? project.plan("Merge shot revision", [
          { op: "animation.put", animation: planShotAnimation(animation) },
        ])
      : null;
  return { ...report, plan };
}
