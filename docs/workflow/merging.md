# Merge independent shot revisions

Keep a common baseline, let each author edit a separate copy, and review conflicts in the assembly project before committing a merge.

<!-- study:shot-merge:start -->
**Bring two edits back together.** What survives when two people change the same shot?

[![Compare the baseline, each separate edit and the merged result. First follow color and placement, then the local color correction and incoming opacity.](../../website/public/art/guides/shot-merge.png)](../../website/public/art/guides/shot-merge.png)

Compare the baseline, each separate edit and the merged result. First follow color and placement, then the local color correction and incoming opacity. Independent changes can be combined. Conflicting changes need an explicit choice rather than silently replacing one person's work.

<!-- study:shot-merge:end -->

## Assemble independent shot revisions

Keep a saved baseline before giving workers separate project copies. Each worker
retains the shot's existing animation, layer, element and key IDs. The assembler
reads their saved results; workers never write the assembly file concurrently.

```ts
import { StoryboardProject, planShotMerge } from 'codeboard-studio';

const baseline = await StoryboardProject.open('base.cboard');
const worker = await StoryboardProject.open('worker-color.cboard');
const assembly = await StoryboardProject.open('assembly.cboard');
const animationId = 'animation:shot';
const result = planShotMerge(
  assembly,
  baseline.shotAnimation(animationId),
  worker.shotAnimation(animationId),
);
if (result.conflicts.some((entry) => entry.resolution === 'unresolved')) {
  console.log(result.conflicts);
} else if (result.plan) {
  await assembly.commit(result.plan, { requestId: 'merge:worker-color:1' });
}
```

`mergeShotAnimation(base, local, incoming)` is the pure snapshot operation.
`planShotMerge` reads the local snapshot from the assembly and returns a native
version-bound plan. Changes on different fields are combined; the local value
survives when the incoming value still matches the baseline. A conflict returns
no animation or plan until resolved. An unchanged result has no plan either;
check the conflict list to distinguish them. None of these preview operations
edits its inputs.

Resolve only the reported paths, for example
`{resolutions: {'/layers/0/elements/0/fill': 'local'}}` as the final argument.
The path is a JSON Pointer into these snapshots; obtain it from the current
report. Unknown or stale resolution paths reject. Choosing `incoming` replaces
that conflict's value; choosing `local` retains the correction. Other independent
incoming changes still apply.

Arrays with identical object IDs in identical order merge field by field.
Competing additions, deletions, reorders and unkeyed arrays require a choice of
the entire array; raster bytes are also atomic. If retiming coincides with another
revision, the conflict at the empty root path requires a whole-shot choice.
The adapter does not infer matching by names, merge topology, or retime local
corrections. It validates the resulting artwork and project references before
producing a plan. Reports are limited to 256 KiB and plans retain the 1 MiB limit.

The baseline must really be the shared ancestor; the merge API cannot infer
provenance from supplied snapshots. Keep the original files/checksums. New media,
palettes and other dependencies must already exist in the assembly. This supplies
shot revision merging, not automatic component refresh or an immutable asset
package registry.

For an isolated native project created by `exportShotProject`, use `planShotHandoffMerge` with
the full original baseline project and reopened worker. It checks stored source provenance,
accounts for intentionally omitted board links and blocks incompatible resource declarations
before producing a merge plan. See [native rig handoff](../animation/rigging.md) for the conflict and
dependency contract. Keep using `planShotMerge` for caller-managed shared-identity snapshots.
