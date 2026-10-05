# Plan shot, editorial and audio edits

Use these commands inside the same saved-plan and receipt workflow as board edits. They address shot-local artwork and independent editorial/audio data.

## Shot-local studio plans

`animation.put` inserts or replaces a complete animation by stable ID. Convert SDK values using `planShotAnimation`; nested raster surfaces use the same raw RGBA base64 contract as `planDrawingElement`. `editorial.put` accepts a complete `EditorialSequence`. Create animations before editorial clips that use them. `animation.remove` and `editorial.remove` take `id`; remove references before removing their targets. Global IDs, local frame bounds and editorial source bounds are validated through the project transaction.

```ts
import { planShotAnimation } from 'codeboard-studio';

const animation = project.shotAnimation('animation:greeting');
const plan = project.plan('Rename shot animation', [{
  op: 'animation.put',
  animation: planShotAnimation({ ...animation, name: 'Greeting close-up' }),
}]);
await project.commit(plan, { requestId: 'revision:greeting-name:1' });
```

For existing artwork, `animation.element.replace` takes `animationId`, `layerId`, the existing element `id`, and an `element` encoded by `planShotElement` (supports local negative reveal frames). `animation.pixels.patch` takes those three IDs plus `region` and `pixelsBase64` under the same bounds and byte contract as `pixels.patch`. These commands avoid sending unrelated artwork; the complete plan still has a 1 MiB JSON limit. Whole-animation replacement is unsuitable for large raster payloads. Use SDK editing and save for those payloads. Studio plans use the same saved-base checks, atomic receipts and retry rules as board plans; studio movie export uses the dedicated [export APIs](../delivery/export.md) with explicit audio mix or omission policies.

`animation.capturePanel` takes `panelId`, a new animation `id`, and optional `name`. It copies current board artwork/camera at the same frame rate, shifts all frame positions by the panel start, and remaps owned IDs and internal references. It does not serialize the copied pixels into the request, so request size does not grow with panel artwork. Generated child IDs are discovered after commit. Use the direct `capturePanelAnimation` method when the source-to-copy ID report is required; plan receipts do not include that report. Capture leaves the board unchanged and does not copy audio, comments, approval status, motion annotations or editorial transitions.

`editorial.edit` takes sequence `id` and an `edits` array with the insert/update/move/remove operations described in [editorial edits](../animation/editing.md). Use one batch for a reorder and its transition corrections: it validates final source ranges and overlap geometry after recalculating start positions. The enclosing plan keeps its usual atomic commit and receipt behavior.

```ts
const plan = project.plan('Extend reaction', [{
  op: 'editorial.edit', id: 'edit:main', edits: [
    { op: 'update', id: 'clip:reaction', changes: { durationFrames: 48 } },
  ],
}]);
```

`studio.audio.set` takes an animation/editorial `ownerId` and complete `tracks`. Use `defineStudioAudio` to validate and normalize rational placement rates before planning. The command shares sample-source validation, project-wide IDs and asset references with `setStudioAudio`; it carries metadata only, while `asset.add`/`asset.update` pin actual media bytes. See [studio audio](../audio/shot-audio.md) for sample clocks, mixing, stems and decoder requirements.

`studio.audio.edit` takes `ownerId` and ordered `edits` using the studio track/clip operations in [studio audio edits](../audio/editing.md). It updates metadata without resending artwork or media bytes. Place related trim/fade corrections in one batch for final-state validation. The outer plan provides existing atomic commit and replay behavior.

`animation.edit` takes animation `id` and an `edits` array using local layer/exposure/drawing/key/camera operations in [shot-local edits](../animation/shot-layers.md). Use complete key values with explicit IDs; key replacement is by ID, and the batch validates final frame positions and dependencies. The command carries metadata without embedding unrelated raster pixels.

The same batch accepts `{op: 'board.link', panelIds: [...]}` to replace stored board-panel links; use an empty list to unlink. IDs must refer to panels in the animation's board shot. Panel capture records its source link automatically. Read current captions/timing through `project.shotBoardPanels(animationId, {offset, limit})`; editing captions does not regenerate final animation. Unlink a panel before deleting it.

For process-based agents, `codeboard frame-job create/run/inspect/read` exposes the same persistent PNG workflow as the API. Create once with an expected saved project version; retain the returned job path and retry `run`, not `create`. Capture stdout JSON and process failure separately. Inspect counts for scheduling, and read/verify selected frames for handoff; row completion is not artistic approval or integrity verification of all rows. Use a copied, unchanged source and an immutable engine installation. Worker ranges are explicit and there is no background scheduler. See [CLI frame jobs](cli.md#persistent-frame-jobs).

After a job is complete, `codeboard frame-job movie job.cjob --mix-audio linear --output delivery.mp4` assembles verified stored frames and mixes the matching saved source's audio. Use `--omit-audio` explicitly for picture-only delivery. The output must be new. This path reuses existing movie encoding; it does not restart frame rendering. Keep job workers idle during movie export because the exporter holds a SQLite read snapshot.
