# Work with your coding agent

Your agent writes and executes JavaScript or TypeScript. Codeboard supplies the drawing, inspection, revision, and rendering tools. You review the results and decide what needs to change.

## Scope the work from the request

Use the user's brief, the actual project state, and the public API contract to choose work. Example scripts are fixtures: their stories, character names, fixed durations, brush palettes, layer layouts, and presentation stages do not become project requirements. Do not infer missing assets, approval, style, or narrative intent from a demo. A scripted terminal presentation is not evidence of autonomous agent execution.

Keep authoring, saved-state revision, verification, and rendering separate. Type-check source before execution. Open the current saved project for revisions and render that state afterward; do not run its original generator as a rendering shortcut. Reports should name the source/version, exact checks, and any review still pending. See the [runnable examples and their scope](../examples/README.md).

## Set up the agent plugin

[Install the Codeboard skills](agent-plugin.md) in your compatible agent to add operation guidance and the bundled API reference. The guide covers plugin installation in Codex and Claude Code, portable skill folders for Cursor, Copilot, Gemini CLI, OpenCode and other hosts, verification, and updates. Install the [engine from npm](install.md) with `npm install -g codeboard-studio` in the agent's execution environment, then open your agent in the artwork folder.

Ask the agent to use the `codeboard` skill for your first task. It establishes the runtime and documentation version and selects the relevant skills for drawing, animation, or revision. The installed reference travels with the plugin, so the agent does not need your source checkout to read it.

## Give the agent a working brief

Before choosing a workflow, inspect the runtime with `codeboard capabilities`, or `await capabilities()` imported from `codeboard-studio`. The JSON report lists runtime/schema/container versions, feature status, relevant operation names, constraints and parser-supported edit-command names. `supported` means the listed scope is implemented; `partial` includes explicit limitations; `unavailable` has no native implementation. This inventory is not a production qualification report.

Discovery does not open a project or spawn a process by default. `codeboard capabilities --probe-dependencies` (SDK: `{probeDependencies:true}`) checks FFmpeg and ffprobe startup in parallel, each with a two-second timeout and 32 KiB output limit. Reports contain separate `dependencies.ffmpeg` and `dependencies.ffprobe` results; both are `unchecked` when probing is disabled. Optional `--ffmpeg <path>` / `ffmpegPath` and `--ffprobe <path>` / `ffprobePath` take precedence over `FFMPEG_PATH` / `FFPROBE_PATH`, then the executable name on PATH. These resolvers are shared with movie export and audio decoding. A successful probe must identify itself as the requested executable. `available` proves startup only; export still needs compatible encoders, dimensions and media. Treat `unchecked` as unknown. Feature availability is not inferred from the executable alone.

A useful starting instruction is:

> Use Codeboard to create an editable animation. Work in this folder. Keep the authoring source, assets, and `.cboard` project. Render a contact sheet and selected frames before exporting a movie. Inspect the images, revise the specific shapes or timings that need work, then show me the result. Use stable IDs for parts we may revise later. Ask before replacing existing work.

Add your subject, duration, canvas ratio, style, and intended deliverables. The [focused examples](../examples/README.md) provide operation-specific source. The [character demo](code-board-demo.md) is a larger optional fixture, not a required workflow.

## Author a small piece first

```sh
codeboard init scene.ts
codeboard run scene.ts
```

Have the agent establish one pose, its brush marks, and its layer structure before multiplying it across shots. Confirm the first image at full size. A successful script execution does not establish drawing quality.

## Inspect before editing

Use `project.production.summary()` for project identity, format, duration and counts without artwork or unbounded audio/comment lists. The legacy `inspect()` returns a larger overview; it is not the default tool response for an agent.

```ts
const summary = project.production.summary();
const shots = project.production.query({ kind: 'shot', limit: 20 });
const shot = shots.items[0];
if (!shot) throw new Error('No shot found; create or import one first');
const children = project.production.query({ parentId: shot.id, limit: 50 });
// Read the next page only when needed and keep the same filters.
const next = children.nextCursor
  ? project.production.query({ parentId: shot.id, cursor: children.nextCursor })
  : null;
```

Check that a query returned the expected object before using its ID. `query()` and `find()` discover projects, sequences, scenes, shots, camera/layer keys, panels, layers/elements, components, assets, brushes, audio tracks/clips, comments and locks. `parentId` means direct owner, not arbitrary descendants; `panelId` scopes panel artwork and review anchors. Drawing alternatives are group children. Use `production.drawingAlternatives(groupId, options)` for child metadata pages and `production.drawingExposures(groupId, options)` for exposure pages; neither returns artwork.

`query()` returns `{ version, items, nextCursor? }`, with 50 items by default and a maximum of 200. Labels are limited to 256 UTF-16 code units and marked `nameTruncated` when shortened; matching uses the full label. IDs are never truncated. A page over 256 KiB fails with `RESOURCE_LIMIT`; reduce its limit or narrow its filters. No geometry or pixel payload is included.

Cursors belong to one open project instance and edit state. Changing filters, editing, undoing or reopening requires restarting the query. A mutation attempt may invalidate a cursor even if it fails. `find()` retains offset pagination and full labels for existing scripts. Neither is a recursive ownership selector.

For independent CLI invocations, use a saved version with offsets instead of an in-memory cursor:

```sh
codeboard query film.cboard --kind shot --limit 20
codeboard query film.cboard --kind shot --offset 20 --expected-version 42
codeboard drawing-data film.cboard mouth-track --kind exposures --limit 50 --expected-version 42
```

Replace `42` with the first response's `version`. `query` emits JSON through `ProjectStore.query()`. Results include `indexed: true` when a current saved metadata catalog is available. This path reads no artwork, brush or document payloads. Legacy files or files saved by older runtimes may return `indexed: false` and use a full-document fallback; queries never rebuild or write the catalog. The next normal save rebuilds it atomically. Store/CLI pages sort IDs in SQLite binary order, while in-memory discovery uses hierarchy order. Use the same path and filters across offset pages and retain the expected version. The entire store response, including summary, is capped at 256 KiB. The existing `inspect`/`ProjectStore.findObjects` path retains its narrower panel-object scope.

`CodeboardError` provides `code`, `details`, `retryable` and `toJSON()`. Query failures use `INVALID_ARGUMENT`, `INVALID_CURSOR`, `STALE_CURSOR` or `RESOURCE_LIMIT`. Saved-version conflicts use `REVISION_CONFLICT` with expected/actual values. A conflict requires reading the latest state and reconsidering the edit, not blindly retrying it. Some SDK operations still throw ordinary errors. The main CLI command rejection boundary serializes these as `OPERATION_FAILED` (or `CANCELLED` for an `AbortError`), while preserving structured domain codes. It writes `{ error: ... }` to stderr and sets exit status 1. Inspect the failure before deciding whether to retry.

CLI reports may include `error.causes`: ordered aggregate failures or a single wrapped cause. Each entry uses the same error envelope. Cause traversal stops after three edges and includes at most eight immediate aggregate children, with `causesTruncated` reporting omitted immediate causes. Domain `details` are preserved separately; stacks are not emitted by this formatter. These cause-count/depth limits are not a byte budget for custom domain details. Startup failures before command parsing and the separate user script process launched by `run` retain their own output paths.

Parser failures such as unknown commands/options, missing arguments and missing option values use the same JSON envelope with `INVALID_ARGUMENT` and `details.parserCode` from Commander. The parser's duplicate text diagnostic is suppressed. Help/version output retains Commander's text and exit status, including error-triggered help; it does not produce a JSON error envelope. This parser boundary is inherited by registered subcommands.

CLI registration defers project/storage/render/audio/preview imports until their command handler runs. Help, version and parser validation therefore do not deliberately load those backends. Module-loading failures during a selected command enter the command error formatter. This does not make `capabilities` or authoring independent of all native dependencies: capability/schema discovery and selected operations still load their own dependencies.

```sh
codeboard inspect film.cboard --panel performance --name Clawd --limit 10
codeboard validate film.cboard
```

Inside a revision script, open the saved project and query `project.production.find(...)`. Read the element or layer identified by the result. Use a crop for a hand or contour problem, a frame sheet for timing, and a layer-isolated onion skin for consecutive drawings. Avoid sending an entire `toJSON()` dump to an agent when a bounded query will answer the question.

## Turn feedback into a specific operation

| Feedback | Edit | Review evidence |
| --- | --- | --- |
| “The foot slides” | Adjust the drawing's foot geometry or placement keys during contact | Consecutive frames against a fixed ground line |
| “Hold before the jump” | Extend a drawing range, or ripple-retime the panel if later timing should move | Before/after playback and the exposure list |
| “Move the camera closer” | Update the shot camera's zoom and pan keys | Start, midpoint, and end frame |
| “Only this hand is wrong” | Edit its contour or replace that drawing | Cropped before/after at the same frame |
| “Use a softer pencil” | Test a derived brush, then explicitly edit selected old strokes | Swatch and artwork detail |
| “Delay the sound” | Update the audio clip start frame | Playback around the contact frame |

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

Import `StoryboardProject` from `codeboard-studio` and `writeFile` from `node:fs/promises`. Replace the example panel ID with a discovered ID. The runnable `examples/agent-revision/src/cli/run.ts` script retains the plan on disk and resumes it on its next invocation.

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

Clip input follows the audio SDK: asset ID, name, timeline start, source-in, duration, volume and both fades. The asset must exist in the project or be added by an earlier command in the same plan. Plans edit references and do not re-encode source audio. All timing currently uses integer project frames; sample-based source references belong to the later time-domain migration. A split preserves source continuity, retains only the outer fades and rejects cuts through a fade. Locked source or destination tracks reject clip edits. Unlocking is an explicit `audio.track.update` command, separate from subsequent edits. Removing a track removes its clips but retains the shared source asset.

Media commands are `asset.add` (`asset`, including an explicit ID and checksum) and `asset.update` (`id`, `changes`, including a checksum). Both require a lowercase SHA-256 checksum binding the intended bytes. Compute it with `createHash('sha256').update(bytes).digest('hex')` from `node:crypto`. Paths resolve relative to the saved `.cboard` directory under the same rules as `save()`. These are trusted local authoring operations, not a sandboxed remote upload API.

Planning validates metadata and references without opening media files. Commit embeds and verifies new/replaced bytes inside the same transaction as the edit and receipt. Missing files produce `ASSET_MISSING`; changed bytes produce `ASSET_CHECKSUM_MISMATCH`, with no committed edits or receipt. Correcting the source to match the original checksum permits retrying the same request. A successful replay does not read external source files again. Existing unchanged assets retain their embedded bytes; an update may reuse embedded bytes if the source is absent and those bytes match the supplied checksum. Replacing media requires the new checksum, and all references to that asset ID then use the replacement. A checksum proves byte identity, not codec support or visual/audio quality.

Structure commands create `sequence.add` (`id`, `name`), `scene.add` (`sequenceId`, `id`, `name`), `shot.add` (`sceneId`, `id`, `name`), `panel.add` (`shotId`, `options`), and `layer.add` (`panelId`, `kind`, `name`, `options`, optional `parentId`). Panel/layer options require an explicit `id`; other options match their SDK constructors. Put parent creation before child creation in the command array. Supported layer kinds are `group`, `vector` and `raster`. Missing parents, incompatible layer kinds and duplicate IDs reject the plan without changing the source.

Panel operations include `panel.duration` (`id`, `durationFrames`, explicit `mode: 'ripple' | 'preserve'`), `panel.transition` (`id`, `transition`), `panel.number` (`id`, `number`), `panel.move` (`id`, optional `beforeId` within the same shot), `panel.duplicate` and `panel.remove` (each takes `id`). Duplicate panel/artwork IDs are generated by the engine; discover them after commit. Layer operations include `layer.move` (`id`, optional sibling `beforeId`), `layer.reparent` (`id`, `parentId`, optional `beforeId`) and `layer.remove` (`id`). A null parent moves a layer to the panel root. Omitted `beforeId` appends in the relevant order. These operations reuse dependency, lock, audio-cue, last-panel and timeline constraints. Retiming/moving panels may change downstream timing and revisions; moving them back does not reset revision history. Independent editorial clips use the studio commands below.

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

Component commands are `component.capture` (`layerId`, `id`, `name`), `component.revise` (`id`, `sourceLayerId`), `component.instantiate` (`componentId`, destination `panelId`, explicit instance `id`, optional `transform`), and `component.refresh` (`id`, explicit `comments: 'reject' | 'anchor-to-instance'`). These are the existing static drawing components: capture removes animation/exposure and rejects drawing-sequence capture. Refresh replaces child artwork and local child edits while preserving the instance wrapper. It is not an override-aware asset upgrade. Locked or externally referenced descendants reject refresh. Comments on replaced descendants reject it unless explicitly moved to the instance, preserving their IDs and content. Read [components](components.md) before refreshing an independently edited instance.

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

Wrap related synchronous edits in `project.transaction(label, callback)`. Render after the transaction. If the edit is rejected in the same process, call `undo()`; otherwise save it. Use a named [project revision](projects.md) when a checkpoint must survive restarting the agent.

Keep the before/after frame number, affected IDs, and intended timing change in the agent's response. `production.changesSince(version, { limit })` helps identify edits but does not judge their artistic success.

## Resume in another session

Give the next agent the project path, authoring folder, and the latest review request. It should reopen the `.cboard` file rather than regenerate from an outdated script. Source code explains how the artwork was authored; the saved project contains the current edited state.

Scripts run with your local account's permissions. Codeboard has no built-in model, chat service, or agent scheduler. Use npm to check for and install runtime updates. For reproducible automation, install a pinned project dependency and commit its lockfile.

### Shot-local studio plans

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

For existing artwork, `animation.element.replace` takes `animationId`, `layerId`, the existing element `id`, and an `element` encoded by `planShotElement` (supports local negative reveal frames). `animation.pixels.patch` takes those three IDs plus `region` and `pixelsBase64` under the same bounds and byte contract as `pixels.patch`. These commands avoid sending unrelated artwork; the complete plan still has a 1 MiB JSON limit. Whole-animation replacement is unsuitable for large raster payloads. Use SDK editing and save for those payloads. Studio plans use the same saved-base checks, atomic receipts and retry rules as board plans; studio movie export uses the dedicated [export APIs](export.md) with explicit audio mix or omission policies.

`animation.capturePanel` takes `panelId`, a new animation `id`, and optional `name`. It copies current board artwork/camera at the same frame rate, shifts all frame positions by the panel start, and remaps owned IDs and internal references. It does not serialize the copied pixels into the request, so request size does not grow with panel artwork. Generated child IDs are discovered after commit. Use the direct `capturePanelAnimation` method when the source-to-copy ID report is required; plan receipts do not include that report. Capture leaves the board unchanged and does not copy audio, comments, approval status, motion annotations or editorial transitions.

`editorial.edit` takes sequence `id` and an `edits` array with the insert/update/move/remove operations described in [animation](animation.md). Use one batch for a reorder and its transition corrections: it validates final source ranges and overlap geometry after recalculating start positions. The enclosing plan keeps its usual atomic commit and receipt behavior.

```ts
const plan = project.plan('Extend reaction', [{
  op: 'editorial.edit', id: 'edit:main', edits: [
    { op: 'update', id: 'clip:reaction', changes: { durationFrames: 48 } },
  ],
}]);
```

`studio.audio.set` takes an animation/editorial `ownerId` and complete `tracks`. Use `defineStudioAudio` to validate and normalize rational placement rates before planning. The command shares sample-source validation, project-wide IDs and asset references with `setStudioAudio`; it carries metadata only, while `asset.add`/`asset.update` pin actual media bytes. See [audio](audio.md) for sample clocks, mixing, stems and decoder requirements.

`studio.audio.edit` takes `ownerId` and ordered `edits` using the studio track/clip operations in [audio](audio.md). It updates metadata without resending artwork or media bytes. Place related trim/fade corrections in one batch for final-state validation. The outer plan provides existing atomic commit and replay behavior.

`animation.edit` takes animation `id` and an `edits` array using local layer/exposure/drawing/key/camera operations in [animation](animation.md). Use complete key values with explicit IDs; key replacement is by ID, and the batch validates final frame positions and dependencies. The command carries metadata without embedding unrelated raster pixels.

The same batch accepts `{op: 'board.link', panelIds: [...]}` to replace stored board-panel links; use an empty list to unlink. IDs must refer to panels in the animation's board shot. Panel capture records its source link automatically. Read current captions/timing through `project.shotBoardPanels(animationId, {offset, limit})`; editing captions does not regenerate final animation. Unlink a panel before deleting it.

For process-based agents, `codeboard frame-job create/run/inspect/read` exposes the same persistent PNG workflow as the API. Create once with an expected saved project version; retain the returned job path and retry `run`, not `create`. Capture stdout JSON and process failure separately. Inspect counts for scheduling, and read/verify selected frames for handoff; row completion is not artistic approval or integrity verification of all rows. Use a copied, unchanged source and an immutable engine installation. Worker ranges are explicit and there is no background scheduler. See [CLI frame jobs](cli.md#persistent-frame-jobs).

After a job is complete, `codeboard frame-job movie job.cjob --mix-audio linear --output delivery.mp4` assembles verified stored frames and mixes the matching saved source's audio. Use `--omit-audio` explicitly for picture-only delivery. The output must be new. This path reuses existing movie encoding; it does not restart frame rendering. Keep job workers idle during movie export because the exporter holds a SQLite read snapshot.

### Missing media executables

Movie export and the FFmpeg audio decoder report executable lookup failures (`ENOENT` or `ENOTDIR`) as `CodeboardError` with code `MISSING_DEPENDENCY`. Details contain `dependency` (`ffmpeg` or `ffprobe`), the selected `executable`, and the OS `reason`. This error is not automatically retryable: install/configure the executable before retrying. CLI entrypoints serialize this error using their existing structured error path.

The movie encoder waits for the child process to start before requesting its first PNG. Source validation and audio preparation may already have happened, and output parents or reserved/temporary files may have been created; existing cleanup rules still apply. Startup success does not prove codec availability or valid media. Permission failures, nonzero codec exits, malformed media and cancellation are not classified as missing dependencies. Cleanup failures can still surface as an AggregateError retaining the original dependency error. The optional capabilities probe remains a separate bounded availability report, not a prerequisite or a substitute for export-time checks.


### Locate a failing domain edit

Individual failures inside `reviseShotAnimation`, `reviseEditorialSequence` and `reviseStudioAudio` (including project adapters) carry zero-based `editIndex`, `editOperation` and `editDomain` (`shot-animation`, `editorial` or `studio-audio`) in `CodeboardError.details`. Typed errors retain their code, message, retryability, domain details and original cause. Generic operation failures become `INVALID_ARGUMENT` with the original message.

Inside a plan these fields coexist with `commandIndex` and `commandOperation`. For example, a rejected `clip.split` in the third edit of `studio.audio.edit` reports `editIndex: 2` and `editOperation: 'clip.split'`, alongside its split/fade diagnostic. Input-schema and final-state validation failures do not receive a guessed edit index. These algorithms continue to edit isolated drafts and return only after final validation; contextual errors do not publish partial drafts.


### History publication and exhausted counters

In-memory authoring transactions publish their undo entry and clear redo only after validation and audit recording succeed. Undo/redo prepare the restored document and its new audit record before moving history entries; an audit failure restores the current document and leaves the history entry available. This concerns session history, not a new durable-store transaction protocol.

ID allocation and audit-version advancement reject unsafe integer overflow with `RESOURCE_LIMIT`, using `details.reason: 'PROJECT_ID_LIMIT'` or `'PROJECT_VERSION_LIMIT'` and the current counter. Counters are never reset or wrapped automatically. Retain the source when a counter is exhausted; lowering counters can reuse identities and invalidate external references.

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
package registry. See the [worker merge study](visual-examples.md#merge-worker-revisions-and-retain-a-local-correction)
for two saved workers, source preservation, an overlapping color correction and
durable retry.

For an isolated native project created by `exportShotProject`, use `planShotHandoffMerge` with
the full original baseline project and reopened worker. It checks stored source provenance,
accounts for intentionally omitted board links and blocks incompatible resource declarations
before producing a merge plan. See [native rig handoff](rig-workflow.md) for the conflict and
dependency contract. Keep using `planShotMerge` for caller-managed shared-identity snapshots.
