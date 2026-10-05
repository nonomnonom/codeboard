# Animation

![Frames 0 through 23: a triangle moves right and switches to a diamond at frame 12](https://codeboard.nonom.xyz/art/guides/drawing-timing.png)

Placement interpolates continuously while drawing substitution changes the silhouette at frame 12. There is no generated in-between drawing. [Run the visual studies](visual-examples.md).

Codeboard supports drawing substitutions, layer keyframes, and timed panel sequences. Timeline positions are global, zero-based integer frames. At 24 fps, 48 frames last two seconds.

![Walk, anticipation, takeoff and landing drawings from the runnable character example](https://codeboard.nonom.xyz/art/code-board-demo/key-drawings.png)

For a complete working sequence, follow [the Codeboard demo](code-board-demo.md). It separates changing character geometry from placement keys and holds drawings on twos.

## Arrange panels

```ts
const shot = project.addScene('Street').addShot('Discovery');
const first = shot.addPanel({ id: 'notice', title: 'Notice the light', durationFrames: 48 });
const second = shot.addPanel({ id: 'reach', title: 'Reach toward it', durationFrames: 72 });
```

Panels follow each other in shot order. Here the first panel occupies frames 0–47 and the second 48–119. Add action, dialogue, camera notes, and general notes with panel options or `panel.revise(...)`.

## Frame-by-frame drawings

Create a group for a drawing track, with one child group or layer for each pose:

```ts
const track = first.addGroup('Hand drawings');
const relaxed = first.addGroup('Relaxed', {}, track.id);
const reaching = first.addGroup('Reaching', {}, track.id);
// Draw each pose in layers inside its group.
project.production.setDrawingSequence(track.id, [
  { frame: 0, drawingId: relaxed.id },
  { frame: 12, drawingId: reaching.id },
  { frame: 36, drawingId: relaxed.id },
]);
```

A drawing holds until the next key. `drawingId: null` creates a blank. Before the first exposure, the track is blank. A child drawing may combine vector lines and raster paint. Separate tracks can animate hands, eyes, or wings independently.

To replace a frame range while preserving the surrounding exposures:

```ts
project.production.setDrawingRange(track.id, 18, 24, relaxed.id);
console.log(project.production.drawingSequence(track.id));
console.log(project.production.drawingNeighbors(track.id, 20));
```

The end frame is exclusive. Drawing substitutions switch artwork; they do not morph one drawing into another. Use [onion skins](review.md) to compare poses.

## Animate a layer

```ts
const startKey = project.production.addLayerKeyframe(track.id, 0, {
  transform: { x: 0 }, easing: 'ease-in-out',
});
project.production.addLayerKeyframe(track.id, 36, { transform: { x: 100 } });
project.production.addLayerKeyframe(track.id, 0, { opacity: 1 });
project.production.addLayerKeyframe(track.id, 36, { opacity: .5 });
```

Position, scale, rotation, opacity, and depth have independent channels. An opacity key leaves position unchanged. Unkeyed channels use the layer's base values. Before or after a channel's keys, its nearest keyed value holds.

Easing belongs to the key at the start of a segment. Choose `linear`, `ease-in-out`, `hold`, or a cubic Bézier object such as `{ type: 'cubic-bezier', x1: .2, y1: 0, x2: .8, y2: 1 }`.

## Read, move, or remove keys

```ts
console.log(project.production.layerKeyframes(track.id, { limit: 20 }));
project.production.updateLayerKeyframe(track.id, startKey, { frame: 2 });
project.production.removeLayerKeyframe(track.id, startKey);
```

Adding a key on an occupied frame merges the supplied properties into that key. Keep key IDs for targeted updates.

## Change the pace

```ts
project.production.setPanelDuration(first.id, 60, 'ripple');
```

Ripple retiming changes the panel duration, remaps its interior animation times, and shifts following panels and associated timing. Audio clips starting at or after the panel's old end move by the duration difference. Clips starting inside or before the panel keep their placement and source duration; audio is not time-stretched. Review internal cues and crossing ambience after retiming. Codeboard does not silently shorten a later shot to retain the old total duration.

Retiming uses integer frame positions. If shrinking would collapse distinct keys or drawing exposures onto the same frame, it rejects the edit; remove or move the conflicting keys first. Locked affected audio can also block retiming. `preserve` mode rejects a duration change that would create a gap or overlap; it does not compensate another panel.

Key collisions in panel retiming and project `preserve-seconds` frame-rate conversion throw `CodeboardError` with code `INVALID_ARGUMENT`. The first detected collision has `details.reason: 'FRAME_COLLISION'`, `operation: 'panel-retime' | 'timebase-conversion'`, `ownerId`, `collection: 'keyframes' | 'drawingSequence'`, `targetFrame` and the two original `sourceFrames`. `keyframes` covers layer and camera keys; the owner identifies the layer or board shot. Inspect that owner and explicitly move/remove a conflicting key before retrying. This is a first-conflict diagnostic, not an exhaustive report; collapsed intervals and other timing failures keep their existing error forms.

## Layer visibility and independent tracks

```ts
project.production.setExposure(track.id, { startFrame: 12, endFrame: 48 });
```

Exposure limits a layer and its descendants to an interval with an exclusive end. Pass `null` to remove that visibility window. A layer exposure does not select a drawing. Use separate drawing-sequence groups for independently timed eyes, hands, mouths, or wings.

`duplicateDrawing(groupId, drawingId, name)` makes a separate editable pose in the same track. `setDrawingSequence(groupId, null)` removes substitution behavior; ordinary child layers then render according to their own visibility. It does not delete drawings.

## Inspect and remove a channel

```ts
import { evaluateLayer, evaluateDrawing } from 'codeboard-studio';
const layer = project.production.layer(track.id);
console.log(evaluateLayer(layer, 24));
const sequence = project.production.drawingSequence(track.id);
console.log(evaluateDrawing(sequence.keys ?? [], 24));
project.production.removeLayerKeyframeChannels(track.id, startKey, ['opacity']);
```

Use channel removal on a key that contains that channel. Removing a whole key discards every channel on it; removing one channel preserves the others. Drawing substitutions are separate from transform keys.

## Transitions and stroke reveal

```ts
project.production.setTransition(first.id, { type: 'dissolve', durationFrames: 8 });
```

Available transitions are `cut`, `dissolve`, `wipe-left`, and `wipe-right`. For a drawn-on stroke, supply `reveal: { startFrame: 0, endFrame: 24 }` when creating a raster stroke. Pen sample timestamps alone do not animate a stroke.

Transition duration must fit inside its panel. Use `renderFramePNG` or a movie to review a transition: a single-panel render evaluates that panel's artwork, not the timeline blend. Stroke reveal is blank at its start frame and complete at its end frame. Shot animation supports a [typed compositing graph](export.md#save-a-shots-compositing-graph); automatic in-between drawing generation is not currently provided. Shot mesh authoring is implemented below but still awaits runtime qualification.

## Exact tick conversion

`normalizeRate(23.976)` returns `{numerator:2997, denominator:125}`. It preserves the decimal value; it does not infer `24000/1001`. Supply that fraction explicitly when required.

```ts
import { normalizeRate, rescaleTime } from 'codeboard-studio';
const fps = normalizeRate({ numerator: 24000, denominator: 1001 });
const sample = rescaleTime(24, fps, 48000, 'exact');
// sample.value is 48048; sample.exact is true.
```

`rescaleTime(position, sourceRate, targetRate, rounding)` converts integer ticks between positive rates. Rates accept positive finite numbers or safe-integer numerator/denominator objects. Intermediate arithmetic uses BigInt; returned positions must fit a safe integer. Policies are `nearest` (default, ties toward positive infinity), `floor`, `ceil`, and `exact` (rejects quantization). `error` contains reduced integer strings describing rounded minus exact destination position. Negative tick positions support studio preroll; board authoring methods retain their nonnegative frame rules.

Project `preserve-seconds` retiming reuses this mapper and retains collision/collapsed-interval rejection. Project board timelines still store a numeric rate and global frames. Board rates remain numeric; studio animations and editorial sequences persist their own rational rates.

## Shot-local animation and editorial values

`defineShotAnimation(value)` validates an isolated animation with `{id, shotId, name, frameRate, durationFrames, canvas, layers, cameraKeyframes}`. Its frame rate is an explicit rational object. Layer keys, drawing exposures, camera keys and stroke reveals address signed local frames relative to output frame zero. Existing layer/element shapes are reused; the definition copies its input. `renderShotFramePNG(animation, frame)` renders that local frame.

`defineEditorialSequence(value, animations)` validates `{id, frameRate, clips}` against a supplied animation library. Each clip has `{id, animationId, startFrame, sourceInFrame, durationFrames, transition}`. Placement/duration use editorial frames; sourceInFrame uses animation frames. Different rates select source frames with exact rational conversion and floor sampling, without modifying source animation.

The first clip starts at zero. A cut requires zero transition frames and the next clip starts at the preceding end. A dissolve or wipe requires a positive overlap: the next clip starts at preceding end minus transition duration. Overlaps must be shorter than both clips; three simultaneous clips and trailing transitions are rejected. Source bounds are checked through the last exposed frame. `resolveEditorialFrame(sequence, animations, frame)` reports source frame addresses and transition progress. `renderEditorialFramePNG` uses the existing layer renderer and shared transition compositor; overlapping sources must have matching dimensions.

An optional `holdFrames` delays source playback by that many **editorial** frames, holding
`sourceInFrame` in the picture. Source position is `sourceInFrame + floor(max(0, localFrame -
holdFrames) * sourceRate / editorialRate)`. Zero/omission preserves normal playback. A hold
can equal the clip duration for a completely still clip; larger holds reject. Frame-rate
conversion and source bounds use the advancing part of the clip. The source animation is
unchanged. `editorial.edit` can update the hold; splitting divides it between both pieces and
requires an integral source boundary only when the source has advanced.

Shot audio is silent for the initial hold and then plays at normal speed from source-in.
Sequence audio remains independent. Audio conform windows report `playbackStart` for a
nonzero hold, retaining the full clip's output range and transition ramps. No repeated or
stretched source audio is synthesized. OTIO cut export rejects nonzero holds, including with
loss reporting enabled; bake held media and supply new media bindings explicitly.

To match a board's frozen incoming transition, extend the incoming clip by the overlap and
set `holdFrames` to that overlap. For two 24-frame panels and a six-frame dissolve, clip one
starts at 0 for 24 frames; clip two starts at 18 for 30 frames with a six-frame hold. Its
source-in remains the original panel start (local 6 if captured with six pre-roll frames).
The total stays 48 frames. The editorial study compares mapped frames and a split
inside a hold. This primitive
does not itself copy board audio/review records; use the explicit board capture planner below.

Store these values with `project.setStudio({animations, editorial})` and read an inspection copy through `project.studio`. Schema-5 `.cboard` files persist this payload independently from the board timeline; checkpoints retain it. Animation IDs, camera/layer/key/element IDs, sequence IDs and clip IDs must be unique across the project, and animation.shotId must reference an existing shot. `production.query()` discovers the new objects. Use `shotAnimation(id)` and `editorialSequence(id)` for inspection copies, `putShotAnimation` and `putEditorialSequence` to insert or replace values by stable ID, and `removeShotAnimation` or `removeEditorialSequence` to remove them. Referenced objects cannot be removed while references remain. `reviseShotElement` preserves element identity; `patchShotPixels` changes a bounded raster rectangle. These methods reuse project transactions, undo and lock checks. Portable studio commands are documented in [agent workflows](agent-workflow.md). Existing board layer handles do not address studio layers. Use `planBoardCapture` for explicit full-board capture with transition holds and audio conversion or omission. Studio movies support explicit audio mixing through the dedicated [export APIs](export.md); default project renders still use the board timeline.

### Capture existing panel animation

`planBoardCapture(project, options)` captures an entire board into independent animations and
a conforming editorial sequence without deleting or retiming the board. Read `boardPanels()`
in pages (default 50, maximum 200, 256-KiB response limit) for timing, transition, dimensions,
shot IDs and revisions without artwork payloads. Supply exactly one explicit destination
animation/clip mapping for every panel; input mapping order does not change board order.

For saved files, `ProjectStore.boardPanels(page, { expectedVersion })` returns the same item
shape plus saved version, frame rate, duration, panel count and `indexed`. Its read snapshot
uses the panel metadata table without decoding panel artwork. A current catalog supplies the
summary without any payload decode; legacy/stale catalogs fall back to decoding the header.
Reads do not rebuild the catalog. This query validates returned metadata shapes and safe times,
but full payload/index consistency still requires storage verification. The board-conversion
consumer compares live and stored timing.

`ProjectStore.editorialClips(sequenceId, page, { expectedVersion })` returns a bounded saved
clip page with version, sequence frame rate, duration and total clip count. It selects the
editorial field through the payload codec, leaving sibling shot artwork/resources encoded.
It still parses the studio structural tree and decodes the editorial collection; it is not a
per-clip SQL index. Reads verify the selected payload bytes and schema, but do not replace full
relationship/index/artwork verification. The same snapshot covers version checking and results.

```ts
const capture = planBoardCapture(project, {
  sequenceId: 'edit:board-v1',
  panels: [
    { panelId: 'panel:first', animationId: 'animation:first', clipId: 'clip:first' },
    { panelId: 'panel:second', animationId: 'animation:second', clipId: 'clip:second' },
  ],
  audio: { mode: 'convert', sampleRates: { 'asset:voice': 48000 } },
});
// Save capture.plan as JSON before commit; keep the mapping/report with the production source.
await project.commit(capture.plan, { requestId: 'capture-board-v1' });
```

The planner uses normal panel captures plus one `editorial.put` in a version-pinned plan.
Incoming holds preserve the board's freeze semantics and total duration. It rejects incomplete
or duplicate mappings, existing destination IDs, noncontiguous timing, mismatched transition
dimensions and an unused transition on the last panel. It supports up to 999 panels within
the existing 1000-command/1-MiB plan limits. Captures retain editable curves and board links;
captions, motion annotations, review status, comments and locks remain on their original owners.
There is no inferred artistic approval or transfer of board track locks to new audio tracks.

Audio policy is required. `convert` copies board tracks into **sequence audio**, preserving
names, mute, volume, source asset references and rational cue starts. Provide the actual decoded
sample rate for every referenced asset; the planner does not probe, decode or resample media.
Source trim endpoints and fades convert from board frames to those source sample clocks.
The default `exact` rejects quantization; explicit `nearest`, `floor` or `ceil` reports rounded
positions. Collapsed samples or overlapping fades reject. Audio IDs are generated as
`sequenceId:audio-track:sourceTrackId` and `sequenceId:audio-clip:sourceClipId`, validated as new
IDs and returned in the report. At most 1000 audio tracks and 1000 clips are accepted. Media
availability, decoded lengths and sample-rate truth are checked by the downstream audio pipeline.

`audio: { mode: 'omit' }` explicitly creates a picture-only sequence and reports the omitted
track count. The source board/media remain intact. The report includes source project/version,
panel mappings/revisions, audio identity mappings and quantized-position count. This is an
authoring conversion, separate from legacy-container migration. Older runtimes whose strict
editorial schema lacks `holdFrames` reject held clips. Preserve the original file for handoff.

The editorial study prepares a saved full-board capture, reopen/replay and transition-frame
comparisons. The audio-delivery study separately prepares a saved board-audio conversion with
real WAV decoding, source trim/fade checks, PCM comparison against the shot mix, and reopen/replay.
It also checks silent shot-audio preroll during an editorial hold and independently placed
sequence audio. These are bounded technical fixtures, not long-form production qualification.

```ts
const capture = project.capturePanelAnimation('panel:greeting', {
  id: 'animation:greeting', name: 'Greeting',
});
const animation = project.shotAnimation(capture.animationId);
```

Capture creates a new animation linked to the same shot. It copies editable artwork, brush values, raster pixels, layer transforms, exposures, drawing choices, masks, rigs and shot camera curves. Each frame position becomes `globalFrame - panel.startFrame`; pen timestamps stay in milliseconds. Studio keyframes, exposures, drawing choices and stroke reveals accept signed safe integer frames, including keys before zero and after the animation end. Keeping those keys preserves interpolation rather than baking or truncating curves. Output frames and editorial source-in positions remain nonnegative and inside the animation duration. Board timing validators remain nonnegative.

Owned layer/element/key IDs are regenerated; mask, rig and drawing references point to the copied identities. Component source references retain their original library binding. The returned report records the source project version, panel revision, frame range and copied IDs. Layer/key/element correspondence is recorded by the clone owner at ID allocation, rather than inferred from paired traversal positions. Persist this report separately if the production needs conversion provenance; it is not a saved-revision fingerprint. Source artwork and review records remain unchanged. Capture rejects an existing animation ID or any project-wide ID collision.

This captures one panel's animation, without board annotations, comments, approval, audio or transitions. Board transition rendering freezes the incoming panel at its start; ordinary editorial overlap advances both sources. Explicit editorial `holdFrames` can represent the incoming freeze. Capture alone does not claim equivalent full-board delivery.

Optional `preRollFrames` and `postRollFrames` add editable handles, defaulting to zero. With
six frames on each side of a 24-frame panel, the captured shot spans 36 frames and the original
panel starts at local frame 6. Use `sourceInFrame: 6, durationFrames: 24` for its original cut.
All copied frame positions become `globalFrame - (panel.startFrame - preRollFrames)`; no curve
is stretched or baked. Handles evaluate the panel's own artwork/camera curves beyond its cut,
including normal endpoint holds and exposure windows. They do not copy neighboring panels or
generate new motion. A handle may begin before board frame zero.

Capture reports retain the original panel `startFrame`/`durationFrames` and add
`captureStartFrame`/`captureDurationFrames` for the expanded source range. Handle counts must
be nonnegative safe integers and the complete range must remain safe. The same options work
in `animation.capturePanel` plans. The editorial-cuts consumer compares keyed motion with
handles and interior frames.

### Edit an editorial sequence

`project.editEditorial(sequenceId, edits)` applies ordered edits and recalculates contiguous clip positions using each outgoing transition's overlap. `reviseEditorialSequence(sequence, animations, edits)` performs the same operation on an isolated value and returns a validated sequence. Both accept 1–1000 edits:

- `insert`: a complete `clip` without `startFrame`, and optional `beforeId`; omitted destination appends.
- `split`: clip `id`, interior clip-relative `atFrame` in editorial frames, and explicit `newId` for the right piece. The left keeps its ID and ends in a cut; the right retains the original outgoing transition.
- `update`: clip `id` and `changes` containing `animationId`, `sourceInFrame`, `durationFrames` or `transition`. Change source-in alone to slip the source; changing duration ripples subsequent clips.
- `move`: clip `id` and optional `beforeId`; omitted destination appends. Moving before itself preserves order.
- `remove`: clip `id`. A sequence must still contain at least one clip; remove the sequence explicitly when it is no longer needed.

```ts
project.editEditorial('edit:main', [
  { op: 'update', id: 'clip:reaction', changes: { durationFrames: 48 } },
  { op: 'move', id: 'clip:reaction', beforeId: 'clip:exit' },
]);
```

IDs in later edits refer to the result of earlier edits in the same batch. Start positions are derived after all edits. Transitions travel with clips; a new final clip must explicitly end in a cut. Include transition corrections in the same batch when moving/removing clips. Invalid source ranges, unknown IDs, duplicate IDs, consumed clips, three-way overlaps and an empty result reject the entire operation. The engine does not shorten a transition or source range to make an edit fit. All duration/transition values use editorial frames; source-in uses the source animation's frame rate. These edits do not retime source animation or board/audio tracks.

### Reuse a frozen render source

For repeated frames, create `createShotRenderSession(animation)` or `createEditorialRenderSession(sequence, animations)` once. The session validates and copies its inputs during creation. Subsequent edits to the original values do not affect it; create another session for the new revision. Both provide `durationFrames`, rational `frameRate`, `frame(number)` returning a canvas, and `png(number)` returning a promise of PNG bytes. Callers own returned canvases and should reset their 2D context after use; `png()` handles canvas cleanup internally. Returned metadata is separate from the private snapshot.

Artwork-cache surfaces, camera-composition surfaces and review-sheet canvases use the shared 32 megapixel surface validator. Nonpositive, fractional or unsafe dimensions report `INVALID_ARGUMENT` with `details.reason: 'INVALID_SURFACE_DIMENSIONS'`; area overflow reports `RESOURCE_LIMIT` with `reason: 'SURFACE_PIXEL_LIMIT'`. Both include width, height and maxPixels. Numerical overflow during artwork-bound calculation reports `RESOURCE_LIMIT`, `reason: 'ARTWORK_BOUNDS_RANGE'` and layerId instead of treating the artwork as empty. These are per-surface checks, not a cap on total render memory. `createRenderSession` accepts a nonnegative safe-integer `maxCacheBytes`; zero disables retained artwork caching. Invalid cache budgets report `INVALID_ARGUMENT` with `reason: 'INVALID_CACHE_BUDGET'`.

```ts
const session = createEditorialRenderSession(sequence, animations);
await writeFile('frame-24.png', await session.png(24));
const mapping = session.resolve(24);
```

Editorial sessions additionally expose `resolve(frame)` with the same source mapping as `resolveEditorialFrame`. The resolver uses precomputed rational conversion and binary search over validated clip starts. `createEditorialResolver(sequence, animations)` supplies the same isolated mapping and duration without initializing canvas rendering. Resolution is independent of call order. All transitions in a render session must have matching source dimensions, even if a particular frame request does not touch them; cuts may change dimensions. Sessions hold their copied artwork in memory and do not constitute a persisted cache, render queue or memory-budget guarantee.

### Edit local animation channels

`project.editShotAnimation(animationId, edits)` applies a validated batch through the existing project transaction. `reviseShotAnimation(animation, edits)` applies the same algorithm to isolated values and returns a new animation. A batch contains 1–1000 operations:

- `layer.set`: `layerId` and `changes` using `LayerChanges`. A null mask removes the mask binding; nested transforms are complete replacements.
- `layer.exposure`: `layerId` and an exclusive-end local `exposure` interval, or null to remove the interval.
- `layer.drawings`: group `layerId` and local drawing-sequence `keys`, or null to remove substitution selection. An empty sequence produces blank exposures.
- `layer.key.put`: `layerId` and complete `LayerKeyframe` in `key`; `layer.key.remove`: `layerId` and key `id`.
- `camera.key.put`: complete `CameraKeyframe` in `key`; `camera.key.remove`: key `id`.

```js
project.editShotAnimation('animation:greeting', [{
  op: 'camera.key.put',
  key: { id: 'camera:greeting-push', frame: 24, zoom: 1.2, easing: 'ease-in-out' },
}]);
```

Put operations insert or replace by stable ID, not by frame. Provide all intended keyed channels; omitting an old channel removes it from that key. Keys are sorted by frame and duplicate frame positions reject at final validation. A batch can swap two key positions without an intermediate collision failure. Signed safe-integer local frame positions support preroll. Empty-property keys, incompatible depth/rig edits, missing targets, invalid masks/drawing dependencies and duplicate identities reject. The project additionally enforces global IDs, foreign layer locks and referenced assets/components. Existing board keyframe methods retain their board-specific behavior. Commands omit unrelated artwork, but the current project transaction may still clone artwork internally; this is not a copy-cost guarantee.

### Construct and reorganize shot layers

`animation.edit`/`editShotAnimation` also accept:

- `layer.add`: explicit `id`, `kind` (`raster`, `vector`, `group`), `name`, optional layer `options`, optional group `parentId` and sibling `beforeId`. Creates an empty layer; omitted parent means the root and omitted insertion target appends. Options accept signed local exposure times.
- `layer.move`: `layerId`, explicit `parentId` (null for root), optional `beforeId`. Reorders/reparents with local transforms unchanged; this does not preserve world-space placement automatically. Parenting under self/descendants rejects. Moving before itself within the same parent is a no-op.
- `layer.remove`: `layerId`; removes the subtree.
- `layer.rig`: group `layerId` and a two-bone `definition`, or null to unbind.
- `layer.depth`: root `layerId` and positive `depth`.

Later operations address the hierarchy produced by earlier ones. Final validation rejects dangling masks, drawing selections, invalid rig elbows and nested keyed depth planes; revise dependent bindings in the same batch. Project review anchors and locks are preserved, so removal that would orphan them rejects. Resolve/re-anchor/remove those records explicitly rather than losing them during topology edits. New IDs must be globally unique.

Fill a drawing layer with `project.addShotElement(animationId, layerId, element)`, supplying a complete editable element with a stable ID. `removeShotElements(animationId, layerId, ids)` removes a nonempty set of unique IDs from that layer. Both reuse project transactions, type compatibility, global identity and reference validation. Plan equivalents are `animation.element.add` (encode its element using `planShotElement`) and `animation.element.remove`. Raster plans retain the 1 MiB total plan budget; the SDK can author larger surfaces directly.

### Pose a local two-bone rig

Add `layer.rig.pose` to a shot animation edit batch:

```js
project.editShotAnimation('animation:greeting', [{
  op: 'layer.rig.pose', layerId: 'rig:arm', frame: 24,
  target: { x: 180, y: 80 }, bend: 1, easing: 'ease-in-out',
  rootKeyId: 'key:arm-24', elbowKeyId: 'key:elbow-24',
  unreachable: 'reject',
}]);
```

The target is in the rig root parent's coordinate space, not camera/output space. The operation evaluates current joint transforms at the signed local frame, solves the existing two-bone rig, and writes sparse rotation keys for root and elbow. It retains other keyed channels and per-channel easing, selects the nearest equivalent rotations and applies the supplied easing to rotation only (default linear). Existing keys at that frame must use their existing IDs; a key ID belonging to another frame rejects rather than moving it. New IDs must be globally unique.

Choose `unreachable: 'reject'` for an atomic failure outside the rig's reachable range, or `'clamp'` to pose at its reachable boundary. The choice is required for shot edits. Board `production.poseTwoBoneRig` and board `rig.pose` plans accept the same policy optionally, defaulting to the existing clamp behavior. Existing unit-scale, origin-pivot and fixed-elbow-offset constraints remain enforced. Foreign joint/ancestor locks reject at the project boundary. Board rig posing retains its existing nonnegative-frame and generated-ID behavior, using the same pose preparation algorithm. This adds local two-bone posing, not mesh/envelope deformation or generalized constraints.

Two-bone domain failures use `CodeboardError` with code `INVALID_ARGUMENT` and a machine-readable `details.reason`. The numerical solver reports `INVALID_IK_INPUT`, `IK_LENGTH_RANGE`, `IK_TARGET_RANGE`, or `IK_RESULT_RANGE`. Structure validation reports `RIG_ELBOW_PARENT`, `RIG_DRAWING_SELECTION`, `RIG_JOINT_TRANSFORM`, or `RIG_ELBOW_OFFSET`, with `rootId` and the relevant `elbowId`/`jointId`. Pose preparation reports `RIG_REACH_POLICY`, `RIG_FRAME`, `RIG_MISSING`, or `RIG_UNREACHABLE`; unreachable rejection retains the solution and adds root/frame context. Board configuration rejects a nongroup root with `RIG_ROOT_KIND`. These diagnostics cover domain checks; schema parsing, lookup and lock failures retain their own error contracts. No solver equations or accepted joint constraints change.

### Capture and restore a two-bone rest pose

A configured shot rig can store an explicit rest pose without changing its current keys:

```js
project.editShotAnimation('animation:greeting', [{
  op: 'layer.rig.rest.capture', layerId: 'rig:arm', frame: 0,
}]);
project.editShotAnimation('animation:greeting', [{
  op: 'layer.rig.rest.apply', layerId: 'rig:arm', frame: 48,
  rootKeyId: 'key:arm-rest-48', elbowKeyId: 'key:elbow-rest-48',
  easing: 'ease-in-out',
}]);
```

Capture samples the current batch draft at a signed local frame and replaces `TwoBoneRig.restPose`. It stores root x/y/rotation in the root parent's coordinates and elbow rotation in root coordinates. Ancestor transforms, artwork, opacity, depth, scale and key timing are not captured. Changing the parent later interprets the stored pose in that new parent's coordinates; recapture explicitly when that is not intended.

Apply requires stored rest data (`RIG_REST_MISSING` otherwise). It authors root x/y/rotation and elbow rotation as ordinary keys, preserving other channels and their easing. Supplied easing affects only restored channels; omitted easing retains existing per-channel behavior. Existing keys at the destination frame require their existing IDs. Both keys are prepared before publication; final shot/project checks still reject identity collisions, invalid rigs and locked edits. Use the same operations inside an `animation.edit` plan and retry the exact saved plan/request pair.

Rest data is optional and persists with the rig through normal project saves and identity-remapped copies. Rig definitions without it retain existing behavior. Redefining the rig without `restPose` clears the saved rest. Runtimes predating this strict schema field reject such rig definitions; keep an original copy when handing work to an older runtime. This feature restores a cut-out joint pose; curve, envelope and weighted skin deformation use the separate shot bindings documented below. Runtime persistence and rendered restoration are still awaiting qualification under the current static-first implementation strategy.

### Convert a canvas target for shot IK

`project.shotCoordinates(animationId, targetId, {frame, camera})` returns the geometric transforms for a layer or drawing element. The standalone `shotCoordinates(animation, targetId, options)` validates and copies its animation input. Frame defaults to local zero and accepts signed safe integers for preroll; camera defaults to enabled. `camera: false` omits the camera plane transform.

```js
import {transformPoint} from 'codeboard-studio';

const space = project.shotCoordinates('animation:greeting', 'rig:arm', {frame: 24});
if (!space.frameToParent) throw new Error('Rig parent transform cannot be inverted');
const target = transformPoint(space.frameToParent, {x: 480, y: 270});
project.editShotAnimation('animation:greeting', [{
  op: 'layer.rig.pose', layerId: 'rig:arm', frame: 24, target,
  rootKeyId: 'key:arm-24', elbowKeyId: 'key:elbow-24', unreachable: 'reject',
}]);
```

`localToFrame` and `frameToLocal` map the target's own coordinates. `parentToFrame` and `frameToParent` map its parent's coordinates: the containing group for a layer, or containing drawing layer for an element. Root layers use the camera plane as their parent mapping, including animated depth. Transforms include ancestor pivots and animation; element matrices apply only to local mapping. Singular or unstable inverses return `null`; forward transforms remain available. This is geometry inspection, independent of visibility, exposure, masks or pixel coverage, and does not descend into component definitions. The existing `production.coordinates` board query uses the same kernel and now also returns parent transforms; its frames remain nonnegative and global.

### Inspect studio timing without copying artwork

Use `project.editorialClips(sequenceId, {offset, limit})` to read clip source ranges and transitions in editorial order. `project.production.cameraKeyframes(animationId, {offset, limit})` accepts a shot-animation ID as well as a board-shot ID; animation keys retain signed local frame positions. Existing `production.layerKeyframes(layerId, options)` and rig/drawing-sequence reads already accept studio layer IDs.

Paged caption, timing, audit and audio detail responses reject serialized output above 256 KiB with `RESOURCE_LIMIT`. Reduce the page limit or narrow the request; detail text is not silently truncated. This limit complements the existing 50-record default/200-record maximum. Explicit whole-document/artwork reads remain bulk APIs.

### Map mouth cues to editable drawings

`compileLipSync` turns frame cues and a mouth-to-drawing map into normal `DrawingExposure` keys. Ranges are half-open (`startFrame` inclusive, `endFrame` exclusive). Gaps use `restDrawingId`; `null` explicitly blanks the track. Manual correction intervals override cues and restore the underlying cue/rest at their end. Overlapping cues, overlapping corrections, unknown mouth labels and intervals outside the requested range reject instead of guessing.

For an existing shot drawing group, `planShotLipSync` applies only the requested local-frame window and restores the pre-existing drawing at its end:

```ts
import { planShotLipSync } from 'codeboard-studio';

const plan = planShotLipSync(project, 'animation:dialogue', 'layer:mouth', {
  startFrame: 0, endFrame: 72,
  mouths: { A: 'drawing:open', M: 'drawing:closed' },
  restDrawingId: 'drawing:closed',
  cues: [
    {startFrame: 8, endFrame: 18, mouth: 'A'},
    {startFrame: 18, endFrame: 24, mouth: 'M'},
  ],
  corrections: [{startFrame: 12, endFrame: 14, drawingId: 'drawing:closed'}],
});
// Persist the plan before committing so a timed-out request can be retried unchanged.
await project.commit(plan, {requestId: 'dialogue-mouth-pass-01'});
```

The group must already have a drawing sequence and direct-child mouth drawings. Every used drawing ID is validated against that group. Existing keys outside the requested range stay in place; artwork is unchanged. Cue times use the shot's local frame domain, so moving the editorial cut does not retime the mouth keys.

The saved project contains the resulting editable exposures, not a hidden speech-processing service. Keep cue/mapping inputs in TypeScript or JSON source when you need to regenerate them. Manual corrections included above are baked and survive save/reopen. Later direct exposure edits also persist; rerunning generation over the same range intentionally replaces those keys, so include wanted corrections in the new input. No phoneme detector or automatic acting-quality approval is supplied.

`rescaleLipSync(options, { sourceRate, targetRate, rounding })` converts the full input range,
cue intervals and manual correction intervals together into a detached `{ options, report }`.
Both rates are rational `{ numerator, denominator }` values. Frame positions use exact rational
intermediates; the default `exact` rejects fractional results. Explicit `nearest`, `floor` or
`ceil` allows rounding but never drops a collapsed cue/correction. Signed local positions are
supported. Mouth labels, drawing mappings and correction assignments are retained. The report
counts converted endpoints and quantized endpoints, including the outer range.

For reanalysis, retain the source correction records while replacing `cues`, then rescale the
combined input to the target shot clock and pass the returned options to `planShotLipSync`.
For example, 24→48 fps maps a correction `[10,13)` to `[20,26)`. Update the shot duration/rate
separately with `timing.retime`; this helper does not edit the project or stretch audio. Stored
source options should carry their frame rate so they are not converted twice. Direct edits to
baked drawing keys cannot be inferred as correction records; preserve those deliberately in
the source options before regeneration. Out-of-range retained corrections reject.

The lip-sync study prepares a separate 48-fps project and saves its revised source JSON and
plan. It replaces supplied cues, retains a manual correction, then checks that correction and
the resumed cue after reopening. External speech analysis is outside this fixture; review
the supplied cues against the actual dialogue recording.

### Keep board panels linked to final animation

`ShotAnimation.boardPanelIds` stores an ordered list of source-board panels. New panel captures record their source panel automatically. Existing animations without the optional field have no links; opening them does not infer provenance.

```ts
project.editShotAnimation('animation:greeting', [
  {op: 'board.link', panelIds: ['panel:greeting', 'panel:reaction']},
]);
const captions = project.shotBoardPanels('animation:greeting', {offset: 0, limit: 20});
```

Links must be unique, contain at most 4,096 IDs, and address existing panels belonging to the animation's `shotId`. The standalone `reviseShotAnimation` API validates the list structure; a project transaction validates panel existence and ownership. An empty list clears the links. The same edit is available inside an `animation.edit` plan, and links persist in studio snapshots and named checkpoints.

`shotBoardPanels()` returns detached panel metadata in link order, including captions, board timing and panel revision, excluding layers and motion annotations. It defaults to 50 records and caps each page at 200; caption byte size is not separately capped. These are current board captions, not frozen script revisions. Board caption/timing changes never regenerate captured artwork or local keys. Deleting a linked panel rejects until it is explicitly unlinked; unlink and delete may share one project transaction. This does not provide script-file import, screenplay anchors or automatic animation retiming. Older runtimes whose strict studio schema lacks this field cannot open newly linked animations; retain the original project when handing work to those runtimes.

These reads return independent values. Pagination defaults to 50 records and caps at 200. Offset pages address the current in-memory state, so restart pagination after an intervening edit. These are count limits, not a serialized-byte budget. No animation layer tree or raster pixels are copied when reading editorial clips or camera keys.

### Split without shifting picture sampling

```ts
project.editEditorial('edit:main', [
  {op: 'split', id: 'clip:reaction', atFrame: 24, newId: 'clip:reaction-tail'},
]);
```

`atFrame` is an offset from the clip's beginning, strictly between zero and its duration. The right source-in advances by the exact conversion from editorial frames to source frames. At equal rates every interior integer boundary is representable. For 30 fps editorial and 24 fps source, offsets divisible by five are exact; offset one rejects because the current clip model cannot retain that fractional sampling phase. No rounding policy is applied implicitly.

A split preserves the total picture duration and existing outer transitions when the resulting sequence is valid. Existing overlap constraints still apply to each piece; adjust transitions in the same batch if necessary. Subsequent operations may address either piece by its ID. Source animation, drawing keys and sequence-level audio placements remain unchanged. Shot audio is re-conformed for the two resulting source windows; inspect the audio conform quantization report when frame boundaries do not map to integer output samples. Picture sampling continuity is not a guarantee of bit-identical resampled audio. General fractional-phase splits and speed/reverse clips remain unsupported.

## Bake a weighted shot pose

Use `layer.pose` in `reviseShotAnimation` or `project.editShotAnimation` to blend selected numeric channels against the current shot draft evaluated at a signed local frame. The same edit is accepted by the durable `animation.edit` plan command.

```ts
project.editShotAnimation('walk-shot', [{
  op: 'layer.pose',
  layerId: 'hand',
  frame: 18,
  keyId: 'hand:pose:18',
  mode: 'replace',
  weight: 0.5,
  values: { x: 120, rotation: 0.3 },
  easing: 'ease-in-out',
}]);
```

`replace` computes `(1 - weight) * evaluated + weight * supplied` for each supplied channel. `additive` computes `evaluated + weight * supplied`; all supplied values are numeric deltas, including scale, opacity and depth. A scale delta of zero leaves scale unchanged; a delta of one adds one to its evaluated scale. Rotation is in radians and blends numerically without shortest-angle wrapping, preserving explicit turns.

Weights must be finite in `[0, 1]`; at least one finite channel value is required. A zero weight still authors keys for those channels using the evaluated values. Unspecified channels and their easing remain untouched. Explicit easing applies to supplied channels; otherwise the existing key/channel easing is retained, with linear easing for a new key. Final keys must have finite transforms, opacity in `[0, 1]` and positive depth; invalid results reject rather than clamp. Rig constraints and top-level depth rules still apply through final shot validation.

Use the existing key ID when this frame already has a key. An ID belonging to another frame rejects, and final validation rejects duplicate IDs or unresolved frame collisions. Each edit samples the current batch draft, so additive edits accumulate in order. Use persisted request IDs when retrying a durable plan; re-authoring an additive edit is another addition.

The stored result is an ordinary sparse keyframe and uses existing save, undo, render and export paths. No closure or new project field is persisted. This supplies local channel pose baking. For named controls and transferred animation, use the controller operations below.

Pose preparation errors use `INVALID_ARGUMENT` with `details.reason`: `POSE_KEY_ID_MISMATCH` includes the existing key ID, `POSE_KEY_ID_FRAME` includes its existing frame, and `POSE_RESULT_INVALID` includes schema issue paths, mode and weight. Each includes target layer/key/frame. Shot edit errors add `editIndex`/`editOperation`; plan execution also adds command context. Whole-batch final validation remains separate and is not attributed to a particular pose edit.

## Replace one shot drawing hold

Use `layer.drawing.range` for a local correction without reconstructing the entire sequence:

```ts
project.editShotAnimation('walk-shot', [{
  op: 'layer.drawing.range',
  layerId: 'mouth-track',
  startFrame: 10,
  endFrame: 14,
  drawingId: 'mouth-closed',
}]);
```

The target must already be a drawing-sequence group; initialize it with `layer.drawings` when needed. The edit replaces exposure keys within `[10, 14)` and restores the prior sequence's drawing at frame 14. An existing key at the end boundary remains. Use `drawingId: null` for a blank hold. Signed local frames permit preroll; the range must be nonempty and its endpoints safe integers. Keys outside the range remain, including repeated drawings; the operation does not compact the sequence.

The final shot validator checks child drawing references and drawing-group constraints. Within one edit batch, define any new referenced drawing before final validation. The edit is also accepted by `animation.edit` plans. Board `production.setDrawingRange` shares the replacement algorithm and keeps its global nonnegative frame contract.

`project.production.drawingNeighbors(groupId, frame, { skipBlank: true })` accepts board or shot-animation drawing group IDs. Board queries use global panel frames; shot queries use local frames in `[0, durationFrames)`. Results contain at most current/previous/next drawing intervals, clipped to the owning panel or shot, without returning artwork. Preroll keys determine the shot's initial exposure; querying outside its output duration rejects. `skipBlank` skips blank neighboring intervals while retaining a blank current interval. Consecutive keys referencing the same drawing form one hold in this read view.

## Inspect drawing data in pages

```ts
const keys = project.production.drawingExposures('mouth-track', { offset: 0, limit: 50 });
const choices = project.production.drawingAlternatives('mouth-track', { offset: 0, limit: 50 });
```

These reads accept group IDs in board panels, components or shot animations. Exposure pages preserve sequence order and return detached `{ frame, drawingId }` records; `null` means the group has no drawing sequence, while `[]` means an empty sequence or a page beyond its end. Alternative pages preserve child order and contain only `{ id, name, kind }`, including for ordinary groups. Nongroup targets reject.

Both use offset pagination with default 50, maximum 200 records and a 256 KiB response limit. Oversized records reject with `RESOURCE_LIMIT` instead of truncation. Finish paging one project version before editing; these offset pages do not carry revision-bound cursors. Use `drawingNeighbors` to inspect holds around a frame. The existing `drawingSequence` returns the full sequence and child metadata and remains available for callers that explicitly need it.

## Shot mesh authoring (awaiting runtime qualification)

A shot can bind one indexed vertex animation to each layer through `meshes: [{ layerId, mesh }]`.
`layer.mesh` replaces a binding; `mesh: null` removes it. Use the same edit through
`reviseShotAnimation`, `project.editShotAnimation`, or an `animation.edit` plan.

For an existing binding, `layer.mesh.key.put` takes `{ layerId, key: { frame, vertices, easing } }`.
It inserts or replaces the complete pose at that signed local frame and keeps other keys.
`layer.mesh.key.remove` takes `{ layerId, frame }` and requires an existing key. Mesh keys use
frame identity; moving a pose requires remove and put in one batch. Removing the last key
retains the binding and its bind pose. Neither operation changes source vertices or topology.
Missing bindings/keys reject with `MESH_BINDING_MISSING`/`MESH_KEYFRAME_MISSING` plus edit
context. Final draft validation still enforces vertex counts, geometry and track budgets;
interpolated frames remain validated at evaluation time.

```ts
const revised = reviseShotAnimation(animation, [{
  op: 'layer.mesh',
  layerId: 'layer:art',
  mesh: {
    source: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 0, y: 200 }],
    triangles: [[0, 1, 2]],
    keyframes: [
      { frame: 0, vertices: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 0, y: 200 }], easing: 'linear' },
      { frame: 12, vertices: [{ x: 0, y: 0 }, { x: 230, y: 20 }, { x: 20, y: 210 }], easing: 'linear' },
    ],
  },
}]);
```

The referenced layer must already exist. Bind and keyed vertices are in layer-local space;
layer placement follows deformation. Artwork outside the bind triangles is omitted. Groups
warp their composed children, including the selected drawing. Signed local key frames must
be ordered and unique; interpolation uses the outgoing key's easing. No keys means the bind
pose; frames outside the key range extend its nearest pose. Topology stays fixed across keys.

Each shot accepts at most 256 bindings. Each mesh accepts 4096 triangles, 12288 vertices,
4096 keys and 262144 stored vertex positions. Validation rejects duplicate bindings, missing
layers, empty geometry, malformed topology, degenerate faces and winding reversal. Valid key
poses do not guarantee valid in-between geometry: render evaluation validates the requested
pose and can reject it. Global triangle intersections are not currently prohibited.

Bindings are retained by the strict shot/studio schema and existing plan/persistence payloads.
Remove bindings before removing their layers or descendants in the same edit batch; dangling
bindings reject the final draft. Reparenting retains layer-local vertex coordinates. Older
runtimes with strict shot schemas reject the new field: keep the original project for older
readers, and do not strip bindings as a compatibility conversion.

`shotCoordinates` rejects any target beneath a mesh binding with `NON_AFFINE_COORDINATES`;
a single affine matrix cannot describe the warp. Use `shotPointCoordinates` below to map
individual points. Masks crossing independently deformed ancestors reject explicitly.

Mesh surfaces use CPU rasterization with fixed 2×2 subpixel coverage and a top-left edge rule.
Coverage samples are composited before resolving the output pixel, preventing shared triangle
edges from reducing transparent alpha. Texture shading uses premultiplied bilinear sampling at
pixel centers; identity warps retain texels. Actual overlapping faces composite in triangle order
with source-over. Source textures and output remain RGBA8, not a floating-point color pipeline.
The existing 32-megapixel surface limit still applies. Each warp also caps the sum of clipped
triangle bounding-box coverage tests at 268435456 samples before reading texture pixels.

The [transparent mesh study](visual-examples.md#preserve-alpha-across-mesh-edges) and mesh
renderer regressions exercise identity pixels, shared-edge alpha, both windings/face orders,
true overlaps, a masked texture, saved edit/retry/reopen, random/backward seeking and point
round trips. These are bounded fixtures. Full character interaction, independently deformed
masks, high-resolution throughput and broad production qualification remain open.

### Map points through mesh and parent transforms

```ts
const mapped = shotPointCoordinates(animation, 'layer:art', { x: 25, y: 40 }, {
  direction: 'localToFrame', frame: 12, camera: true,
});
const inverse = shotPointCoordinates(animation, 'layer:art', { x: 80, y: 90 }, {
  direction: 'frameToLocal', frame: 12, camera: true,
});
```

The target may be a layer or drawing element. The query applies the element matrix, then
each layer's mesh and placement from child to root, followed by the root's camera/depth
mapping. Inverse queries reverse that order. Frame defaults to zero; camera defaults to true.
Frames may be signed safe integers, including preroll and frames outside the shot duration.

Each result contains `candidates`, with a mapped `point` and a `faces` trail of layer IDs,
triangle indices and barycentric weights in traversal order. No candidates means the point
fell outside a mesh domain. Shared edges and overlaps can produce multiple candidates,
including identical mapped points; no candidate is silently selected or deduplicated.
Without deformation, the result has one candidate with an empty face trail.

Singular or unsafe affine inverses reject with `SHOT_POINT_TRANSFORM`; forward mapping can
still map a point through a collapsed transform. Candidate expansion is capped at 4096 per
step and intermediate/final responses at 256 KiB, with resource-limit errors rather than
truncation. This is a geometric query, not a visibility or hit-test result: opacity, exposure,
drawing selection, masks, clipping and final canvas cropping do not filter candidates.
The deformation regression fixtures verify forward/inverse mapping against known translations
for curve, envelope and controller-driven skin bindings under a shared transformed parent.
They also compare masked rendered pixels with an independently placed reference. Arbitrary
nested deformations and production character rigs require further qualification.

The [nested mesh study](../examples/studies/src/studies/animation/mesh-warp.ts) combines
plan authoring, saved bindings, reopen/retry, point mapping and three-frame export. It is
registered in the studies runner and generates editable source, a PNG sheet and a movie.
Generation alone does not qualify every nested geometry or rig configuration.

Mesh textures account for layer and ancestor magnification when selecting raster resolution.
This avoids an unnecessary low-resolution intermediate when artwork is enlarged. Existing
surface-pixel and raster-work budgets still apply: extreme magnification can reject before
allocating its texture rather than silently lowering quality. The
[magnified ribbon study](../examples/studies/src/studies/animation/deformer-resolution/render.ts)
checks exact bind-pose PNG parity with unbound artwork at 2x placement, saved receipt replay
and backward seeks. Its moving curve is sampled from interpolated controls, preserving ribbon
width; baking a curve into vertex keys instead interpolates the resulting vertices.

For repeated frames, use `createShotRenderSession(animation)`. It snapshots the shot and
prepares each bound mesh evaluator once, then evaluates and validates the requested pose
on every frame. `createEditorialRenderSession` retains a session for each source shot it
actually renders, including transition inputs. These are session-local snapshots, not a
global cache; create a new session after editing the source. Pose errors include the
animation ID, layer ID and frame. No speed or memory improvement has been measured yet.

### Inspect mesh data in pages

`shotMeshData(animation, layerId)` returns the first page of key metadata, without pose vertex
arrays. Select `collection: 'triangles'` for indexed topology or `collection: 'vertices'` for
bind vertices. Add `frame` only to a vertex query to inspect its evaluated local pose:

```ts
const keys = shotMeshData(animation, 'layer:art');
const pose = shotMeshData(animation, 'layer:art', {
  collection: 'vertices', frame: 12, offset: 0, limit: 50,
});
```

Pages contain `items`, `total`, `offset`, effective `limit`, `nextOffset`, and counts of vertices,
triangles and keys. Item indices retain their full-collection position. Vertex pages return
`frame: null` for bind data; signed frame queries use normal mesh evaluation and can reject
invalid interpolated geometry. Key pages include frame/easing only. An offset past the end
returns an empty page. Follow `nextOffset` against the same unchanged snapshot; it is not a
revision-pinned cursor.

Page size defaults to 50 and is capped at 200; each response is limited to 256 KiB. Results
are detached from the input. These limits bound response data, not total input validation
cost: the query still validates a complete shot snapshot. Missing bindings reject explicitly.

On an open project, use `project.shotMeshData(animationId, layerId, query)` and
`project.shotPointCoordinates(animationId, targetId, point, options)` for the same contracts
without retrieving the full animation in calling code. Saved-file pagination is available
through [the mesh-data CLI](cli.md#inspect-mesh-data), including an expected-version check.

Foreign layer locks include that layer's mesh binding; group locks include bindings on all
owned descendants. Project transactions compare those shot-level records along with the
locked artwork, so key edits, binding removal and whole-shot/studio replacement use the same
protection. Reordering equivalent bindings alone does not change locked artwork. This protects
owned data, not every upstream influence on its appearance. Standalone `reviseShotAnimation`
operates on detached values and has no project lock context; publish through project mutations
or saved plans to enforce project locks.

### Bake a cubic curve ribbon

`bakeCurveMesh({ rest, segments, keyframes })` returns a `MeshAnimation` for `layer.mesh`.
Each rest/key pose supplies `curve: [start, handle1, handle2, end]` and a positive `width`;
keys also supply signed `frame` and `easing`. All coordinates are layer-local. Keep this
recipe in authoring source and rebake after control-point changes.

The baker samples the existing cubic curve implementation at equal parameter intervals,
offsets each center along its unit normal by half the width, and joins adjacent pairs with
two triangles. `segments` defaults to 32 and accepts 1–2048, subject to the mesh track's
262144-position budget. Increasing segments refines the ribbon approximation; it does not
provide arc-length parameterization, exact curved boundaries or a quality guarantee.

Sampled zero/nonfinite tangents reject with `CURVE_MESH_TANGENT`; ordinary mesh validation
rejects collapsed/inverted faces and bad key order. Global intersections and cusps between
samples are not proved absent. The returned track interpolates baked vertices between keys,
not Bézier control points and normals each frame. Artwork outside the sampled rest ribbon is
omitted. This is a curve-to-mesh authoring operation; curve chains and arbitrary envelope cages are unsupported. The nested mesh study includes a
striped ribbon and its retained curve recipe.

`createCurveMeshEvaluator(recipe)` prepares a private track and returns a function accepting
one signed safe frame. It interpolates all four control points and width using the outgoing
key's easing, then resamples centers and normals and validates the resulting mesh. The return
value has detached `source`, `destination` and indexed `triangles`. No keys uses the rest pose;
nearest keys extend beyond the keyed range. Evaluation is independent of previous requests.

This differs from `bakeCurveMesh` between keys: it samples the interpolated curve instead of
interpolating already-sampled vertices. A valid pair of endpoint curves can still produce an
invalid in-between ribbon; evaluation rejects that frame with diagnostics. Persisted
`layer.curve` bindings now use this evaluator directly. `layer.mesh` continues to interpolate
vertex tracks. The study reports control-curve samples and renders its saved live ribbon.

### Persist a live curve binding

```ts
project.editShotAnimation(animationId, [{
  op: 'layer.curve', layerId, curve: recipe,
}]);
```

Use a `CurveMeshInput` recipe as described above. The shot's `meshes` collection accepts
exactly one `{ layerId, mesh }`, `{ layerId, curve }` or `{ layerId, envelope }` record per layer.
Supplying multiple representations rejects. `layer.curve` replaces the layer's existing binding; any binding
edit with a null value clears it. There is no implicit composition of two deformers on one
layer: use nested groups for composition. Use `layer.curve.key.put` with a complete
`{ frame, curve, width, easing }` key, or `layer.curve.key.remove` with a signed `frame`.
Frame identity, replacement, missing-key rejection and empty-track rest behavior match mesh
key edits. Rest controls and subdivision count remain unchanged. Moving a key requires remove
and put in one batch. Vertex key operations require a vertex mesh; curve key operations require
a curve binding. A mismatched operation rejects with `MESH_BINDING_KIND`.

Normal plan encoding, studio persistence and subtree-lock comparison retain the curve record.
Older strict shot readers reject it. Shot/editorial rendering prepares the live evaluator;
`shotPointCoordinates` and frame-based `shotMeshData` use that same evaluator. Affine
`shotCoordinates` rejects curve ancestry just as it rejects vertex mesh ancestry.

Inspection includes `bindingKind`, `curveRest` and `curveSegments` (null for vertex meshes).
Curve key pages contain four control points and width in addition to frame/easing; vertex
mesh key pages retain metadata only. Vertex and triangle pages describe the sampled ribbon,
not its four authoring controls. Masks retain the existing deformed-ancestor restrictions.
Persistence, renderer/query agreement, locks and old-reader rejection still need runtime
qualification for this binding variant; it does not establish broad production qualification.

### Bake a four-boundary envelope

`bakeEnvelopeMesh({ rest, columns, rows, keyframes })` returns a regular indexed mesh track.
Each pose contains four cubic tuples: `top`, `bottom`, `left`, `right`. Top and bottom run
left-to-right; left and right run top-to-bottom. Their shared endpoints must match exactly.
Keys contain `{ frame, pose, easing }` and use ordered signed local frames.

The baker samples a bilinearly blended Coons patch: it combines opposite boundary blends
and subtracts the bilinear corner blend. Sampled edge vertices retain boundary coordinates.
The grid defaults to 8 columns and 8 rows; subdivisions accept positive integers, with at
most 4096 triangles and 262144 stored positions across rest and keys. Invalid corners reject
with `ENVELOPE_CORNERS`; collapsed/inverted triangles use the shared mesh diagnostics.

Use the result in `layer.mesh`, retaining the envelope recipe in authoring source. The
mesh study now uses it for the outer group around its vertex-mesh child. Interpolation is
between baked vertices; this operation does not persist live envelope controls. It covers
four-boundary patches, not arbitrary closed contour cages, automatic binding or global
intersection prevention.

### Persist an editable envelope

Use `layer.envelope` with `{ layerId, envelope: recipe }` to retain the boundary controls,
rest pose and grid in the shot. `envelope: null` clears the layer's binding. The recipe is an
`EnvelopeMeshInput`; it uses the same strict corner, geometry and budget checks as baking.
`layer.envelope.key.put` accepts a complete `{ frame, pose, easing }` key;
`layer.envelope.key.remove` requires an existing signed frame. The shared draft owner preserves
rest/grid and other keys, rejects wrong binding types, and validates the final shot.

The renderer prepares vertex keys from the saved controls. A fixed-grid Coons surface is
linear in its boundary control coordinates, so interpolation of these prepared positions
represents interpolation of the controls with the same easing (subject to floating-point
rounding). Unlike a curve ribbon, it has no normalized tangent that must be recalculated.
Each evaluated mesh is still checked for degeneracy/foldover; valid endpoints do not prove
all in-between frames valid. No numerical parity measurement has been run for this path.

Rendering, point mapping and frame vertex inspection share the binding evaluator.
`shotMeshData` reports `bindingKind: 'envelope'`, `envelopeRest`, `envelopeGrid`, and bounded
key pages with boundary poses; the two envelope metadata fields are null for other bindings.
The existing one-binding-per-layer, nested-group composition, lock and mask-boundary rules
apply. Older strict readers reject envelope records. The mesh study now saves its outer
control envelope instead of a baked-only track. Save/reopen, key edits, masks, coordinate
agreement and rendered envelope behavior still await runtime qualification.

### Return a deformation to rest

```ts
project.editShotAnimation(animationId, [{
  op: 'layer.deformation.rest.apply', layerId, frame: 48, easing: 'hold',
}]);
```

The operation inserts/replaces one ordinary key at a signed local frame, using mesh source
vertices, curve rest controls/width or envelope rest boundaries according to the existing
binding. Easing defaults to linear and controls the segment leaving this key; the preceding
key determines the approach. Other keys and the rest/topology/grid definition remain intact.
It does not clear animation or reset layer/ancestor transforms. Restore each affected ancestor
separately when returning a nested deformation stack to rest. Missing bindings reject.

The operation delegates to the same key-edit path, including final geometry/budget validation,
project locks and plan receipts. The mesh study now authors a middle envelope pose and returns
the curve/envelope bindings to rest at frame 23; its live skin returns through explicit joint rotation keys.

### Skin vertices with explicit joint weights

`createSkinMeshEvaluator({ source, triangles, joints, weights })` snapshots a skin definition
and returns a function accepting joint poses. Each joint is `{ id, bind }`; each pose is
`{ jointId, matrix }`. Both affine matrices map joint-local coordinates into the mesh's local
space. Each source vertex has 1–8 `{ jointId, weight }` influences. Joint IDs are local to
this definition, not references to project layers.

The evaluator computes `pose × inverse(bind)` per joint and blends the transformed source
vertex using its weights. It supports at most 256 joints and the existing mesh geometry
limits. Bind matrices must be safely invertible. Every vertex requires distinct existing
joint IDs and positive weights summing to one within 64 machine epsilons; accepted rounding
residue is normalized. Each evaluation must supply every joint exactly once. Invalid bind,
weights or pose references reject with `SKIN_*` details. The resulting mesh is validated for
finite geometry, degeneracy and winding reversal before return.

The returned `source`, `destination` and `triangles` are detached and use the mesh coordinate
contract. Use `destination` as a `layer.mesh.key.put` pose to bake a standalone result,
or use the live layer binding below. Automatic weight generation remains unfinished. Linear blend skinning can collapse or fold geometry under some poses; those
poses reject rather than silently disabling validation.

### Drive a skin from animated layer joints

`layer.skin` persists `LayerSkinInput`: the same source, triangles, joints and weights plus
`jointLayers: [{ jointId, layerId }]`. Map every local joint exactly once to an existing layer
in the same shot. Group layers work as a skeleton hierarchy; animate them with ordinary
`layer.pose` or layer key edits. Joint bind matrices map joint-local coordinates into mesh-local
coordinates at the intended rest pose. Supply those matrices explicitly or capture them with `layer.skin.bind.capture` below.
Binding does not overwrite joint keys.

```ts
project.editShotAnimation(animationId, [{
  op: 'layer.skin', layerId: meshLayerId,
  skin: {
    source: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }],
    triangles: [[0, 1, 2]],
    joints: [{ id: 'root', bind: [1, 0, 0, 1, 0, 0] }],
    weights: Array.from({ length: 3 }, () => [{ jointId: 'root', weight: 1 }]),
    jointLayers: [{ jointId: 'root', layerId: rootJointLayerId }],
  },
}]);
```

The example bind assumes coincident mesh/joint local spaces at rest. At each requested frame,
the evaluator composes the existing layer transforms and pivots, converts each joint pose into
the mesh's local space, then applies weighted skinning. Camera, depth and visibility do not
change joint poses; skin coordinates are pre-camera. Shared ancestors act after skinning and
cancel from the relative transform, including shared deformed ancestors. A nonshared deformed
ancestor or a joint inside the skinned layer rejects with `SKIN_DEFORMATION_BOUNDARY`.
Noninvertible mesh-relative transforms reject at evaluation with `SKIN_LAYER_TRANSFORM` and
joint/frame context. Per-frame mesh validation still rejects collapse or winding reversal.

A layer has one binding: skin replaces its previous mesh/curve/envelope binding. `skin: null`
clears it. Removing a referenced joint requires clearing or repairing its bindings in the same
edit batch. Foreign layer locks protect owned layer data and bindings; they do not freeze
upstream joint motion. `layer.deformation.rest.apply` rejects skins with
`SKIN_REST_REQUIRES_JOINT_KEYS`: restore the actual joint keys explicitly, preserving their
normal IDs and locking semantics.

`shotMeshData` supports paged `joints` (bind matrix and mapped layer ID) and `weights`
(vertex index and influences), also available through `mesh-data --kind joints|weights`.
Non-skin bindings return empty pages for these collections. Skin `keyframes` is empty because
animation belongs to its joint layers. Vertex queries without a frame return bind vertices;
frame queries, point mapping and rendering share live evaluation. Pagination and byte limits
are unchanged.

The mesh study replaces its inner vertex binding with a live skin, animates a sibling joint
hierarchy under the outer envelope, and records joint/weight pages after reopening the project.
Older strict
shot readers reject the new skin field; preserve an original when exchanging with them.


### Capture a skin bind pose

```ts
project.editShotAnimation(animationId, [{
  op: 'layer.skin.bind.capture', layerId: meshLayerId, frame: 0,
}]);
```

This replaces each existing skin joint's bind matrix with its evaluated mesh-local transform
at the signed local frame. It uses exactly the same hierarchy, pivot and deformation-boundary
resolution as live skin evaluation. Existing source vertices, topology, weights, mappings and
joint animation keys stay intact. The captured frame becomes the identity skin deformation
(up to floating-point precision), relative to the unchanged source vertices. This operation
**rebinds** the animation: other frames can change appearance. It does not bake the current
visible deformation into a new source mesh or restore a joint pose.

Use it after creating/moving joint layers, including earlier edits in the same batch. A batch
can put a skin with invertible provisional binds and then capture the intended rest frame.
Missing/wrong bindings, dangling mappings, deformation crossings and unsafe transform inverses
reject. Final shot validation also rejects singular captured joint binds. Capture changes the
skin binding owned by the mesh layer, so normal layer locks, transaction rollback, plan CAS and
receipts apply. Later joint edits do not silently recapture bind matrices.

The mesh study invokes capture before authoring tip animation. Static type, lint and dependency
checks cover its source; bind identity, edited-batch capture, locks, rollback and save/reopen
still need runtime qualification.


### Revise skin weights without replacing the binding

```ts
project.editShotAnimation(animationId, [{
  op: 'layer.skin.weights.put', layerId: meshLayerId, vertexIndex: 2,
  influences: [
    { jointId: 'tip', weight: 0.6 },
    { jointId: 'root', weight: 0.4 },
  ],
}]);
```

This replaces the complete influence list for one zero-based source vertex. Each list contains
1–8 distinct existing joints, positive finite weights, and a total of one within the same
rounding tolerance as full skin binding. Omit a joint to remove its influence; zero weights and
empty lists reject. The operation does not normalize arbitrary totals or infer missing weights.
An out-of-range source vertex rejects with `SKIN_WEIGHT_VERTEX`; a non-skin binding rejects
with `MESH_BINDING_KIND`.

Use multiple edits in one `animation.edit` batch to revise several vertices atomically.
Repeated edits to the same vertex follow batch order. Final shot validation checks the resulting
binding before installation; source geometry, topology, bind matrices, joint mappings and
unaddressed weights remain unchanged. Normal layer locks and saved-plan version checks still
apply. Read the paged `weights` collection to prepare a correction. Vertex indices refer to the
current topology, so use version-pinned saved plans when applying agent corrections.

The mesh study revises one vertex after skin binding/capture and records the reopened weight
page. Static checks pass; runtime atomicity, lock rejection, retained data and visible weighted
motion remain to be qualified.


Live skin pose resolution reuses evaluated local layer transforms and relative path matrices
within each frame request. Mesh inverses are shared by joints with the same cancelled ancestor
prefix. All such caches are local to that request; bind capture uses the same resolver. There
is no previous-frame state or cross-frame geometry cache. Runtime seek parity and production
performance still require measurement.


### Named live pose controllers

A shot can store up to 64 `ShotController` records. Each named controller drives up to 256
explicit target layers through one animated weight. Controllers evaluate after ordinary layer
keys in their saved array order; they preserve those base keys. The resulting transform,
opacity and depth feed rendering, affine/mesh point queries and joint skin evaluation.

```ts
project.editShotAnimation(animationId, [{
  op: 'controller.put',
  controller: {
    id: 'controller:bend', name: 'Bend', mode: 'additive', weight: 0,
    targets: [
      { layerId: elbowLayerId, values: { rotation: 0.18 } },
      { layerId: faceLayerId, values: { opacity: -0.1 } },
    ],
    keyframes: [
      { frame: 0, weight: 0, easing: 'ease-in-out' },
      { frame: 12, weight: 1, easing: 'ease-in-out' },
      { frame: 23, weight: 0, easing: 'linear' },
    ],
  },
}]);
```

`replace` blends each addressed channel from its current evaluated value toward the target;
`additive` adds weight times the supplied channel offset. Scale offsets are arithmetic, not
multipliers. Channels are x, y, scaleX, scaleY, rotation (radians), opacity and depth. Unspecified
channels retain their current value. Weight zero has no effect. Weights lie in [0,1]; ordered
unique signed frame keys use existing easing and nearest-key extension, with at most 4096 keys.
The controller's static weight is used only when it has no keys. Layer transforms and targets
are local to each layer's parent space, not world-space constraints.

Updating the same ID replaces its definition in place, preserving stack order. New IDs append;
`{ op: 'controller.remove', id }` removes one and reveals the unchanged base animation where
no other controller acts. `controller.move` explicitly reorders the stack.
Targets must be distinct existing layers per controller; IDs are globally checked by the project.
Layer deletion must repair/remove referencing controllers in the same batch. Object discovery
includes `shot-controller` metadata; complete definitions are in the shot snapshot. Saved plans
and ordinary undo/redo/receipts use the existing shot persistence path.

Foreign layer locks protect every controller touching a locked layer or its descendants,
including its weight, other targets and relative stack order. Controller evaluation rejects
nonfinite results, opacity outside [0,1], or nonpositive depth instead of silently clamping.
Geometry validation still decides whether a controlled skin pose folds or collapses. Controller
parameters cannot reference other controllers, so there is no expression graph or cycle solver.
Drawing selection, arbitrary functions, multidimensional pose interpolation and reusable
performance packages remain separate work.

The mesh study now stores a Bend controller that drives a skin joint and artwork opacity across
three frames. Review those frames when tuning the controller and skin together. Older strict shot
readers reject the controllers field; keep the original for older-reader handoff.


### Edit controller weights, keys and order

```ts
project.editShotAnimation(animationId, [
  { op: 'controller.weight', id: 'controller:bend', weight: 0.25 },
  { op: 'controller.key.put', id: 'controller:bend',
    key: { frame: 12, weight: 0.8, easing: 'ease-in-out' } },
  { op: 'controller.move', id: 'controller:bend', beforeId: null },
]);
```

`controller.weight` changes the static fallback; an existing key track continues to take
precedence. `controller.key.put` inserts or replaces the key at its signed frame and keeps
keys sorted. `controller.key.remove` takes `id` and `frame`, rejecting missing keys. Removing
the final key restores static-weight evaluation. Key edits preserve the name, targets, mode,
static weight and stack position.

`controller.move` places the named controller before `beforeId`; null means the end of the
stack. Moving before itself is a no-op. Missing controllers and insertion targets reject.
Order matters when multiple controllers affect the same channel, especially replace blends.
All these edits run on the isolated shot draft and use the same final validation, lock and
transaction paths as definition replacement. Errors include `CONTROLLER_MISSING`,
`CONTROLLER_KEY_MISSING` or `CONTROLLER_MOVE_TARGET` details.

The mesh consumer authors its weight track through key edits.


### Inspect a controller in bounded pages

`shotControllerData(animation, controllerId, query)` and
`project.shotControllerData(animationId, controllerId, query)` return detached pages.
The query collection is `targets` or `keyframes` (default), with `offset`, `limit` and an
optional signed `frame`. Default page size is 50, capped at 200; the existing 256 KiB response
limit rejects oversized pages rather than truncating records.

Every page includes the controller name/mode, its zero-based stack index, static weight,
target/key counts and `nextOffset`. With a frame, `evaluatedWeight` uses the same weight evaluator
as rendering. Target items then include `evaluatedState`: the layer's final local transform,
opacity and depth after base keys and **all** controllers in stack order, not just the selected
controller. It is not a world-space matrix or deformed geometry. Without a frame, evaluated
fields are null. Key pages retain the authored easing and weights.

Input shot validation still examines the complete snapshot; pagination bounds output, not
validation cost. Missing controllers and malformed queries reject. `nextOffset` is not a
snapshot/version token: pin the saved version when collecting multiple CLI pages or preparing
an edit plan. The mesh study records a middle-frame target page.


### Transfer controller animation with explicit targets

`compileControllerTransfer(sourceShot, targetShot, options)` returns ordinary `ShotAnimationEdit[]`
without changing either input. Select controllers with `controllers: [{ sourceId, targetId }]`,
map their referenced layers with `layers: [{ sourceId, targetId }]`, and supply a signed safe
integer `frameOffset`. Feed the returned edits into `animation.edit` in a version-pinned plan.
The normal project transaction remains responsible for locks and cross-project identity checks.

Mappings must be complete and one-to-one; unused layer mappings reject. Destination controller
IDs must be new, and all destination layers must exist. Final shot validation catches IDs
colliding with other shot objects and controller limits. Existing destination controllers and
base keys remain unchanged; transferred controllers append in the supplied controller mapping
order. Their effects can change the final appearance through normal blending. No automatic
replacement or override merge occurs.

This transfers the complete selected controller definitions and weight tracks. Equal normalized
frame rates are required; offsets use exact integer addition and reject unsafe results. Signed
pre/post-roll keys are retained rather than trimmed to the destination duration. Local pose
values are copied unchanged: compatible hierarchy, pivots, proportions and scale remain the
caller's responsibility. No geometric retarget solver, destructive key-track slicing, drawing transfer,
asset dependency packaging or immutable publication is implied.

The mesh consumer exercises explicit identity transfer on its saved controller, preparing a
replacement destination snapshot and then committing removal plus insertion together. The
source snapshot remains intact. This is a static consumer example, not executed cross-shot or
persistence qualification; full reusable rig/performance packages remain open.


### Limit controller activity to a performance range

Controllers optionally store `activeRange: { startFrame, endFrame }`, using signed local frames
and an exclusive end. Outside that nonempty interval, evaluated weight is zero regardless of
the static weight or keys. Inside, existing interpolation and nearest-key extension apply.
There is no implicit fade at the boundaries; author weight keys when a fade is intended.

```ts
project.editShotAnimation(animationId, [{
  op: 'controller.range', id: 'controller:bend',
  range: { startFrame: 12, endFrame: 36 },
}]);
```

Use `range: null` to remove the gate. This retains all keys, targets and base animation.
Inspection pages expose the saved range and include its gate in `evaluatedWeight` and target
states. Existing controllers without a range retain their previous unbounded behavior.

`compileControllerTransfer` accepts optional `sourceRange` with the same boundaries. It
intersects that selection with each source controller's active range, rejects empty overlaps,
and shifts the resulting interval by `frameOffset`. Without a selection, any existing source
range is still shifted. Both shifted endpoints must remain safe integers.

The full source key track is retained and shifted, including keys outside the selected range.
Those keys provide interpolation context; removing them or synthesizing endpoint keys would
change cubic/eased curves near a trim. Only the active gate limits the transferred performance's
contribution. This is not a filtered-data export: out-of-range source keys remain inspectable.
Base keys and earlier controller contributions remain visible outside the interval.

The saved mesh consumer selects [0,24) during transfer.


### Capture a pose as a controller

`captureShotController(animation, options)` returns a new detached controller definition without
mutating the shot. Explicitly choose the layers/channels and whether `evaluation` uses `base`
layer keys or the fully `controlled` local pose. Replace capture stores absolute channel values;
additive capture requires a `referenceFrame` and stores pose-minus-reference offsets.

```ts
const controller = captureShotController(animation, {
  id: 'controller:lean', name: 'Lean correction',
  mode: 'additive', frame: 12, referenceFrame: 0, evaluation: 'controlled',
  targets: [{ layerId: torsoId, channels: ['x', 'rotation'] }],
});
project.editShotAnimation(animation.id, [{ op: 'controller.put', controller }]);
```

The result has static weight zero and no keys/range. Saving it is initially inert; author a
weight or weight track to apply it. For additive capture, enabling it on top of the original
controlled pose adds the captured delta again. Choose the destination base pose deliberately.
Captured values use local parent coordinates and arithmetic scale offsets, not world-space
constraints, deformation vertices or multiplicative scale ratios.

Targets/channels must be distinct and existing; a new controller ID is required. Capture checks
finite offsets, shot identity/reference limits and insertion capacity through ordinary shot
validation. It retains neither a live reference to the source frame nor a dependency on the
source controller: subsequent source edits do not update the captured pose. The current mesh
study captures and saves an inactive joint correction after reopen.


### Retime an independent shot

`retimeShotAnimation(animation, options)` returns a detached `{ animation, report }` for
inspection before editing. Apply the same options through `timing.retime` in an ordinary
shot edit or version-pinned `animation.edit` plan:

```ts
const options = {
  durationFrames: 48,
  rounding: 'exact' as const,
  audio: 'scale-starts' as const,
};
const preview = retimeShotAnimation(animation, options);
project.editShotAnimation(animation.id, [{ op: 'timing.retime', ...options }]);
```

Every local frame position scales by new duration / old duration. A 12-to-24-frame change
maps frame 11 to 22 and the exclusive end 12 to 24; it does not pin the last key to frame 23.
This includes camera/layer keys, exposures, drawing substitutions, stroke reveal intervals,
controller keys/ranges, mesh/curve/envelope keys and compositing curves. Signed preroll and
postroll positions scale too, without trimming. Pen sample timestamps and bind geometry stay
unchanged. Optional `frameRate` sets the target rational rate; otherwise the old rate remains.

The default `exact` policy rejects fractional frames. Explicit `nearest`, `floor` or `ceil`
permits quantization, but distinct keys mapping to one frame and collapsed intervals still
reject. The source snapshot remains untouched on failure. The report counts mapped positions,
moved positions and quantized positions, plus audio clips and changed cue starts.

Audio policy is required: `preserve-seconds` retains cue times; `scale-starts` multiplies starts
by the new physical duration / old physical duration, accounting for both frame rates with
exact rational arithmetic. Neither policy stretches source samples or fades. Cues can extend
beyond the new duration; playback conform clips them to the shot window.

Editorial cuts are not conformed automatically. Shortening a referenced shot can invalidate a
cut's source range; revise its use before applying the shorter shot. Within a batch, the shot
must already be valid when `timing.retime` runs. Board retiming remains independent.

The `frame-jobs` study includes a separate retiming consumer that doubles a composited motion
shot, extends its cut in the same saved plan, reopens and replays the receipt, then compares
mapped source frames with an editorial frame job. It emits the plan, project, job and a frame
sheet without changing the earlier jobs' pinned sources. This consumer is prepared for later
execution; its fixture contains no audio and does not qualify all timing domains.

### Share a controller performance package

`createControllerPerformance(animation, { id, name, controllerIds })` captures selected
controllers in source stack order into a detached JSON-compatible `ControllerPerformance`.
Its format is `codeboard-controller-performance`, version 1, with source frame rate, complete
controller definitions and a SHA-256 checksum. Duplicate or missing selections reject.

```ts
const performance = createControllerPerformance(source, {
  id: 'performance:lean-v1', name: 'Lean', controllerIds: ['controller:lean'],
});
// Store JSON.stringify(performance) using the authoring project's file workflow.
const imported = readControllerPerformance(JSON.parse(savedJson));
const edits = compileControllerPerformance(imported, target, {
  controllers: [{ sourceId: 'controller:lean', targetId: 'controller:shot2-lean' }],
  layers: [{ sourceId: sourceTorsoId, targetId: targetTorsoId }],
  frameOffset: 24,
});
```

The reader accepts unknown input and validates the strict versioned schema, controller
invariants and checksum. The checksum covers JSON of the schema-parsed payload excluding
`sha256`; outer file whitespace and input object property ordering are not part of identity.
It detects changed logical contents, not producer authenticity. Objects are detached but remain
ordinary editable JavaScript objects; changed payloads fail checksum verification on import.
Use a newly captured package for a new revision. File publication/overwrite policy remains with
the authoring project; this API does not claim filesystem immutability or signatures.

Compilation uses the same transfer owner as direct shot transfer: explicit new controller IDs,
complete one-to-one target mappings, equal frame rates, optional source activity range and safe
integer offsets. It returns ordinary edits for a version-pinned plan. Mapping order specifies
insertion order; preserve package order when its controllers interact. Cross-project global
identity checks and locks remain enforced by the destination project transaction.

This package carries numeric controller performance only. Required layer IDs appear in its
target records and must map to an existing compatible rig. It does not bundle artwork, fonts,
media, base layer keys, drawing substitutions, rig geometry or full dependency manifests.
The mesh study emits `controller-performance.json`, serializes/parses the package and prepares
its saved import plan. Static checks cover this consumer; corruption rejection, independent
agent handoff, saved replay and visual parity still require runtime qualification. Full rig and
mixed drawing/deformer performance packages remain open.
