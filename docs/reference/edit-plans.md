# Commit a retryable edit

Prepare and save a plan when an automation request may need to be retried. Reuse the exact plan and request ID after an uncertain response.

## Keep or reject a revision

### Persist a retryable edit plan

Use a data plan when an orchestrator may lose a response and retry. Save the project first. `plan()` validates commands on an isolated draft and leaves the session untouched; `commit()` executes them as one authoring transaction and saves the edit and receipt atomically.

Saved receipt reads validate that the receipt matches its request ID and advances the base version by exactly one. A malformed receipt throws rather than being treated as a successful retry. Receipt publication is insert-only within the document commit transaction; retry handling returns the existing matching receipt instead of replacing it.

```ts
const project = await StoryboardProject.open('film.cboard', { actor: 'agent:revision' });
const plan = project.plan('Clarify the greeting', [
  { op: 'panel.revise', id: 'panel:greeting', changes: { dialogue: 'Hello again.' } },
  { op: 'panel.status', id: 'panel:greeting', status: 'review' },
]);
// Persist this exact plan and request ID before attempting the commit.
await writeFile('greeting.plan.json', JSON.stringify(plan, null, 2), { flag: 'wx' });
const result = await project.commit(plan, { requestId: 'greeting-review-001' });
console.log(result.receipt, result.replayed);
```

Import `StoryboardProject` from `codeboard-studio` and `writeFile` from `node:fs/promises`. Replace the example panel ID with a discovered ID. For a retry, read the saved plan JSON and reuse the same request ID; do not call `plan()` again for the uncertain commit.

Supported commands currently cover `project.configure`, `project.metadata`, `panel.revise`, `panel.status`, `layer.set`, `layer.exposure`, `layer.depth`, `drawing.sequence`, `drawing.range`, `rig.define`, and `rig.pose`, plus the structure, drawing, camera/layer key, audio, asset, brush, component and review commands below. Their changes use the same validation, timing and lock rules as the corresponding authoring methods. Plans do not execute callbacks; use the existing SDK for those operations. A plan contains at most 1,000 commands and 1 MiB of JSON. It binds the actor, project ID, saved version and exact document fingerprint, including artwork bytes. Command defaults are resolved before computing the plan digest, so an omitted default and its explicit value produce the same normalized intent. The digest detects alteration; it is not an authentication signature. Actor-owned locks remain coordination between trusted local scripts.

`drawing.range` uses a half-open interval `[startFrame, endFrame)` and preserves surrounding holds. A null drawing ID inserts a blank. `rig.define` accepts a two-bone definition or null to remove it; `rig.pose` authors rotation keys at its frame, with optional `bend: 1 | -1` and `unreachable: 'reject' | 'clamp'`. Omitting the policy preserves clamping. Choose `reject` to fail with `INVALID_ARGUMENT` and solver diagnostics in `details.solution` before writing joint keys when the target is unreachable. Plan receipts do not return solver diagnostics; inspect the resulting pose and render before approval. Depth remains restricted to top-level planes.

Failures thrown while applying an individual plan command include zero-based `details.commandIndex` and `details.commandOperation`. Structured domain errors retain their code, message, retryability and other details; for example, a timing collision keeps its `reason`, owner and source frames, while a rejected rig target keeps its solution diagnostics. The original error is available as `cause` in process. Generic failures remain `INVALID_ARGUMENT` and retain the older `details.operation` field as well. Use `commandOperation` to identify the command because a domain's `operation` may describe a lower-level action. Plan parsing, final transaction validation and persistence failures occur outside this per-command boundary and may have no command index.

Camera and layer key commands are `camera.key` / `layer.key` (insert or merge supplied channels at `frame`), `.key.update` (edit a discovered key ID), `.key.remove`, and `.key.removeChannels`. Camera commands take `shotId`; layer commands take `layerId`. Updates take `id` and `changes`, removal takes `id`, and channel removal also takes `channels`. New keys get engine-generated IDs; query them after commit before referencing them in another plan. Adding channels at an existing frame keeps that key's ID and unrelated channels. Updating a key onto an occupied frame rejects the entire plan.

```ts
const plan = project.plan('Camera push and character fade', [
  { op: 'camera.key', shotId: 'shot:greeting', frame: 12, value: { zoom: 1.2, easing: 'ease-in-out' } },
  { op: 'layer.key', layerId: 'layer:character', frame: 12, value: { opacity: 0.8 } },
]);
```

Use IDs from discovery and integer frames in the current global project time domain. The commands share the SDK's sparse-channel and easing rules, rig constraints and plane-depth restrictions.

Audio commands are `audio.track.add` (`id`, `name`), `audio.track.update` (`id`, `changes`), `audio.track.remove` (`id`), `audio.clip.add` (`trackId`, `clip`), `audio.clip.update` (`trackId`, `id`, `changes`), `audio.clip.remove` (`trackId`, `id`), `audio.clip.move` (`id`, destination `trackId`, optional `startFrame`), and `audio.clip.split` (`id`, `frame`). Track creation requires an explicit ID so later commands in the same plan can refer to it. Clips may specify an ID; omitted IDs and the right half of a split receive engine-generated IDs to discover after commit.

Board clip input follows the board audio SDK: asset ID, name, timeline start, source-in, duration, volume and both fades. The asset must exist in the project or be added by an earlier command in the same plan. Plans edit references and do not re-encode source audio. These board commands use integer project frames; [studio audio commands](shot-plans.md) use source samples and rational placement for independent shots and editorial sequences. A board split preserves source continuity, retains only the outer fades and rejects cuts through a fade. Locked source or destination tracks reject clip edits. Unlocking is an explicit `audio.track.update` command, separate from subsequent edits. Removing a track removes its clips but retains the shared source asset.

Media commands are `asset.add` (`asset`, including an explicit ID and checksum) and `asset.update` (`id`, `changes`, including a checksum). Both require a lowercase SHA-256 checksum binding the intended bytes. Compute it with `createHash('sha256').update(bytes).digest('hex')` from `node:crypto`. Paths resolve relative to the saved `.cboard` directory under the same rules as `save()`. These are trusted local authoring operations, not a sandboxed remote upload API.

Planning validates metadata and references without opening media files. Commit embeds and verifies new/replaced bytes inside the same transaction as the edit and receipt. Missing files produce `ASSET_MISSING`; changed bytes produce `ASSET_CHECKSUM_MISMATCH`, with no committed edits or receipt. Correcting the source to match the original checksum permits retrying the same request. A successful replay does not read external source files again. Existing unchanged assets retain their embedded bytes; an update may reuse embedded bytes if the source is absent and those bytes match the supplied checksum. Replacing media requires the new checksum, and all references to that asset ID then use the replacement. A checksum proves byte identity, not codec support or visual/audio quality.

Structure commands create `sequence.add` (`id`, `name`), `scene.add` (`sequenceId`, `id`, `name`), `shot.add` (`sceneId`, `id`, `name`), `panel.add` (`shotId`, `options`), and `layer.add` (`panelId`, `kind`, `name`, `options`, optional `parentId`). Panel/layer options require an explicit `id`; other options match their SDK constructors. Put parent creation before child creation in the command array. Supported layer kinds are `group`, `vector` and `raster`. Missing parents, incompatible layer kinds and duplicate IDs reject the plan without changing the source.

Panel operations include `panel.duration` (`id`, `durationFrames`, explicit `mode: 'ripple' | 'preserve'`), `panel.transition` (`id`, `transition`), `panel.number` (`id`, `number`), `panel.move` (`id`, optional `beforeId` within the same shot), `panel.duplicate` and `panel.remove` (each takes `id`). Duplicate panel/artwork IDs are generated by the engine; discover them after commit. Layer operations include `layer.move` (`id`, optional sibling `beforeId`), `layer.reparent` (`id`, `parentId`, optional `beforeId`) and `layer.remove` (`id`). A null parent moves a layer to the panel root. Omitted `beforeId` appends in the relevant order. These operations reuse dependency, lock, audio-cue, last-panel and timeline constraints. Retiming/moving panels may change downstream timing and revisions; moving them back does not reset revision history. Independent editorial clips use the [shot commands](shot-plans.md).

Drawing commands are `element.add` (`panelId`, `layerId`, `element`), `element.replace` (also takes the existing `id`), `element.remove` (`panelId`, `layerId`, `ids`), `element.outline` (`panelId`, `layerId`, `id`), and `element.boolean` (also takes a path-command `tool` array and `operation: 'union' | 'intersect' | 'difference' | 'xor'`). Use complete validated element values. Raster strokes/surfaces require raster layers; contours, vector strokes and text require vector layers. Replacement retains the stable ID; outline converts an editable vector stroke to an editable contour. Removal uses the SDK's review-anchor cleanup.

Import `planDrawingElement` from `codeboard-studio` to convert a `DrawingElement` to portable plan data. Vector/text/brush geometry remains JSON; raster surfaces use `pixelsBase64` instead of a typed `pixels` array. This stores raw straight-alpha sRGB RGBA8 bytes, not an encoded PNG. The helper validates input and retains exact pixel bytes. A plan rejects unknown element fields instead of silently dropping them.

```ts
const original = project.production.element('element:caption');
if (original.kind !== 'text') throw new Error('Expected a text element');
const plan = project.plan('Correct caption', [{
  op: 'element.replace', panelId: 'panel:greeting', layerId: 'layer:captions',
  id: original.id, element: planDrawingElement({ ...original, text: 'Hello again.' }),
}]);
```

`pixels.patch` takes `panelId`, `layerId`, `id`, an integer `region: { x, y, width, height }` inside a raster surface, and `pixelsBase64` containing exactly `width * height * 4` bytes in row order. Encode with `Buffer.from(patch.pixels).toString('base64')`. The existing pixel API validates region bounds before writing. Only the selected rectangle changes; placement, opacity and other pixels remain intact. Base64 must use canonical padding. Plans still have a total 1 MiB JSON budget, including binary data encoded as text. Use small patches for existing large surfaces; creating/replacing a large raster surface still uses the regular SDK until a larger immutable payload workflow is available.

Brush commands are `brush.create` (`definition` with explicit ID and no version), `brush.revise` (`id`, `changes` excluding ID/version), and `brush.duplicate` (`id`, `name`). Revisions increment the preset version. Existing strokes retain their captured brush values; editing a preset does not repaint old strokes. Use an element replacement when an existing mark must change. Discover the generated duplicate ID after commit.

Component commands are `component.capture` (`layerId`, `id`, `name`), `component.revise` (`id`, `sourceLayerId`), `component.instantiate` (`componentId`, destination `panelId`, explicit instance `id`, optional `transform`), and `component.refresh` (`id`, explicit `comments: 'reject' | 'anchor-to-instance'`). These are the existing static drawing components: capture removes animation/exposure and rejects drawing-sequence capture. Refresh replaces child artwork and local child edits while preserving the instance wrapper. It is not an override-aware asset upgrade. Locked or externally referenced descendants reject refresh. Comments on replaced descendants reject it unless explicitly moved to the instance, preserving their IDs and content. Read [components](../drawing/components.md) before refreshing an independently edited instance.

Review commands are `review.comment` (`body`, `anchor`) and `review.resolve` (`id`). Comments use the plan actor as author. Coordination commands are `lock.acquire` (`targetType`, `targetId`, `reason`) and `lock.release` (`id`). Lock ownership comes from the plan actor, and a different actor cannot release it. Discover generated comment/lock IDs after commit. Locks remain cooperative local coordination, not user authentication, and current review records are not immutable revision approvals.

For an uncertain result, reopen using the same actor and retry **the identical plan and request ID**. A matching receipt returns `{ receipt, replayed: true }` before checking an old base version. The receipt reports the original `committedVersion`, not the latest head. Replay does not replace the open session, discard unsaved work, or restore old artwork. Reopen explicitly to inspect the current saved head. `ProjectStore.readReceipt(requestId)` returns the saved receipt or `null`; close the store when finished.

Reusing an ID with a different plan fails with `REQUEST_ID_REUSED`. A new request whose base differs from either the open session or disk fails with `REVISION_CONFLICT`; reopen, review intervening edits, and create a new plan and request ID. Unsaved local edits must be saved before a new plan can commit. A successful commit updates the session and its undo history; undo itself remains an unsaved edit until saved. Even a plan whose commands leave values unchanged records one completed transaction.

Receipts remain inside the `.cboard` through ordinary saves, named revision restores and compaction. Restoring a revision does not make a previously committed request eligible to run again. Save As creates a separate container and does not copy receipts; retry against the original project path. Receipts use existing SQLite roots, so this feature does not change the container format. Existing `transaction()`/`save()` calls do not implicitly gain request deduplication.

```sh
codeboard plan film.cboard commands.json --label "Caption revision" --actor agent:revision > revision.plan.json
codeboard commit film.cboard revision.plan.json --request-id caption-001 --actor agent:revision
codeboard receipt film.cboard caption-001
```

`commands.json` is a JSON array of the supported commands. Keep the plan file as UTF-8 JSON. Each command prints JSON to stdout; domain errors go to stderr. `receipt` prints `null` when no committed receipt exists. Render and review the affected frames after commit; successful validation does not establish artistic quality.

Wrap related synchronous edits in `project.transaction(label, callback)`. Render after the transaction. If the edit is rejected in the same process, call `undo()`; otherwise save it. Use a named [project revision](../workflow/projects.md) when a checkpoint must survive restarting the agent.

Keep the before/after frame number, affected IDs, and intended timing change in the agent's response. `production.changesSince(version, { limit })` helps identify edits but does not judge their artistic success.
