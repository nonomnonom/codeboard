# Build reusable shots

Keep a performance on its own timeline, then place it in an edit. This page covers shot creation and capturing existing storyboard panels.

<!-- study:editorial-cuts:start -->
**Change the order of two shots.** Can you reorder a sequence without redrawing either shot?

[![Read the first row left to right, then the second. The shot that was second now opens the sequence.](../../website/public/art/guides/editorial-cuts.png)](../../website/public/art/guides/editorial-cuts.png)

Read the first row left to right, then the second. The shot that was second now opens the sequence. The edit chooses shot order and source ranges. Each shot's drawings remain its own source.

<!-- study:editorial-cuts:end -->

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
The total stays 48 frames. This primitive
does not itself copy board audio/review records; use the explicit board capture planner below.

Store these values with `project.setStudio({animations, editorial})` and read an inspection copy through `project.studio`. Schema-5 `.cboard` files persist this payload independently from the board timeline; checkpoints retain it. Animation IDs, camera/layer/key/element IDs, sequence IDs and clip IDs must be unique across the project, and animation.shotId must reference an existing shot. `production.query()` discovers the new objects. Use `shotAnimation(id)` and `editorialSequence(id)` for inspection copies, `putShotAnimation` and `putEditorialSequence` to insert or replace values by stable ID, and `removeShotAnimation` or `removeEditorialSequence` to remove them. Referenced objects cannot be removed while references remain. `reviseShotElement` preserves element identity; `patchShotPixels` changes a bounded raster rectangle. These methods reuse project transactions, undo and lock checks. Portable studio commands are documented in [shot plans](../reference/shot-plans.md). Existing board layer handles do not address studio layers. Use `planBoardCapture` for explicit full-board capture with transition holds and audio conversion or omission. Studio movies support explicit audio mixing through the dedicated [export APIs](../delivery/export.md); default project renders still use the board timeline.

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
but full payload/index consistency still requires storage verification.

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
in `animation.capturePanel` plans.
