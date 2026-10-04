# Code, render, inspect, revise

The engine provides geometric and rendering evidence for an external agent. It does not grade anatomy, staging or artistic quality. Use this loop: locate stable IDs, render the relevant frame and detail, inspect the image, make a targeted edit, compare, then keep or undo it.

## Coordinates and math

`multiplyMatrices`, `matrixFromTransform`, `invertMatrix` and `transformPoint` use affine `[a,b,c,d,e,f]` matrices. Multiplication `A × B` applies B first. Transform construction applies scale, rotation (radians), then translation. Inputs and results must be finite. Inversion rejects singular or numerically ill-conditioned matrices; it is floating-point geometry, not arbitrary-precision arithmetic.

```ts
import { transformPoint } from 'codeboard-studio';
const space = project.production.coordinates(elementId, { frame: 90 });
if (!space.frameToLocal) throw new Error('Target transform cannot be inverted');
const local = transformPoint(space.frameToLocal, { x: 640, y: 360 });
```

`coordinates` accepts a panel layer or drawing-element ID. It composes animated ancestor transforms around their permanent pivots, the element matrix and, by default, the owning shot's camera using the root layer's depth. `camera: false` excludes camera placement. The default frame is the panel start. The independent result contains IDs, frame, `localToFrame` and `frameToLocal` (null when inversion is unsafe), without cloning artwork. `matrixFromTransform(transform, pivot)` also supports an explicit pivot for standalone geometry calculations.

Coordinates are full-resolution panel-frame pixels. Convert a resized or cropped review image's coordinates back to that space first. This is a geometry query: visibility, exposure, opacity, masks and occlusion are not hit-tested. Source component layers have no panel/camera space and are rejected.

## Per-layer onion skin

```ts
import { renderOnionSkin } from 'codeboard-studio';
const png = await renderOnionSkin(project, [
  { panelId, frame: 90 },
  { panelId, frame: 88, layerIds: [characterId], tint: '#58b9e0', opacity: .35 },
  { panelId, frame: 92, layerIds: [characterId], tint: '#e47b69', opacity: .35 },
], { camera: false });
```

Samples may come from different panels or frames. Explicit IDs avoid depending on layer names. Selecting a group includes its descendants; selecting a child retains its ancestor transforms and opacity. Mask and clipping sources remain dependencies even when excluded from the visible selection. Selected/tinted samples render on transparency, so a ghost does not paint another paper background over the current frame. Tint preserves the composited alpha. The first sample defaults to full opacity, subsequent samples to the global opacity; a sample override wins. Up to eight samples are supported.

`renderPanelPNG` also accepts `layerIds`. Its ordinary canvas background remains unchanged. An empty, duplicate or foreign-panel selection is an error.

Frame-by-frame authoring now supports [drawing sequences](drawing-sequences.md): editable drawings are stored once under a group and referenced by exposure keys, including nonadjacent reuse, holds and explicit blanks. These coexist with each layer's optional visibility interval. This is not full Harmony feature parity.

The references are distinct: [Storyboard Pro's onion-skin toolbar](https://docs.toonboom.com/help/storyboard-pro-24/storyboard/reference/toolbars/onion-skin-toolbar.html) compares neighbouring panels and can filter matching layers; [Harmony key exposures](https://docs.toonboom.com/help/harmony-24/essentials/cut-out-animation/about-key-exposure.html) control which drawing remains exposed until the next key.

## Compare and reject a trial

`comparePixels(before, after, { threshold: 0 })` accepts decoded, equally sized RGBA pixel buffers. It reports changed-pixel count, maximum channel delta, mean absolute delta and a bounded changed-region rectangle (or null). Comparison uses premultiplied RGBA, so invisible RGB under zero alpha does not count. A pixel changes when its maximum channel delta is strictly greater than the finite 0–255 threshold. Aggregate delta metrics include all pixels, irrespective of threshold. Inputs remain unchanged. These are pixel differences, not perceptual or quality scores.

## Revising audio tracks

Find audio by name with `production.find({kind: 'audio-track' | 'audio-clip', name, limit, offset})`. Clip search results carry the owning track ID as `parentId`. Targeted reads avoid a whole-project snapshot:

```ts
const tracks = project.production.audioTracks({limit: 20});
// Each row: id, name, muted, locked, clipCount; no clip array or asset bytes.
const cues = project.production.audioClips(trackId, {frame: 252, limit: 10});
const cue = project.production.audioClip(clipId); // clip fields plus trackId
```

`audioTracks` and `audioClips` use the standard pagination default of 50 and maximum of 200. Clip rows retain insertion order. `audioClips` optionally filters by `assetId` and/or a global integer `frame`, applying pagination after filtering. A clip matches `startFrame <= frame < startFrame + durationFrames`. This is placement inspection, so muted tracks and zero-volume clips remain inspectable; it does not assert that their source contains audible samples at that frame. Returned objects are detached copies. For more than one page, advance `offset`; use a stable project version while traversing pages.

```ts
project.production.updateAudioTrack(trackId, {name: 'Rain and street ambience', muted: true});
project.production.updateAudioTrack(trackId, {locked: true});
// Explicitly unlock before editing clips, renaming, muting or deleting this track.
project.production.updateAudioTrack(trackId, {locked: false});
project.production.updateAudioClip(trackId, clipId, {volume: .6, fadeOutFrames: 12});
project.production.moveAudioClip(clipId, destinationTrackId, {startFrame: 288});
const rightClipId = project.production.splitAudioClip(clipId, 300);
// Deliberate removal includes the track's clips; source assets remain available.
project.production.removeAudioTrack(trackId);
```

Track changes honor `expectedVersion` and project locks. The track's `locked` flag is an editing guard, not a separate user-permission system; agents can explicitly unlock it. A call that both unlocks and changes name/mute on a currently locked track is rejected: unlock first. Muting is nondestructive and movie export excludes muted tracks. Unmuting restores their existing placements, trims, volumes and fades. Removing a track retains its source assets and is undoable.

`moveAudioClip` preserves the clip ID, asset, source trim, duration, volume and fades. Omit `startFrame` to retain its timeline position. Both tracks must be unlocked. Moving to a different track appends the clip there; moving within its current track preserves its insertion position. The destination track's mute setting applies immediately. Missing destinations, invalid frames and stale versions fail atomically. Repeating the same move does not create another clip.

`splitAudioClip(clipId, frame)` cuts at a global integer frame strictly inside the clip and returns the new right clip ID. The left part keeps the original ID and fade-in; the right part starts at the cut, advances the source trim by the left duration, and retains the original fade-out. Both parts keep the same asset, name and volume. The right part is inserted immediately after the left in track inspection order. No source audio bytes are duplicated and no other cue moves. The track must be unlocked. A cut strictly inside either fade is rejected because the current envelope model cannot preserve that partial fade; choose a cut between the fades or explicitly reauthor the envelope first. Boundaries at the exact fade endpoints are allowed. Repeating the same cut on the left ID fails at its new end instead of creating duplicate clips. Splitting is undoable and honors `expectedVersion`.

Audio track/clip edits copy the audio collection once on first write in an authoring transaction, rather than copying panel artwork, component geometry or brush libraries. This still copies audio metadata and still runs document validation; it is not constant-cost editing for arbitrarily large audio timelines. Save/open preserves track settings. Tests cover locked-edit failures caught inside a transaction, undo/redo, rollback, persistence, a real muted MP4 export that does not load an unavailable muted source, and identical decoded audio before and after transferring one clip between unmuted tracks.
