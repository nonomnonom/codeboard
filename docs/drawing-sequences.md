# Frame-by-frame drawing sequences

A group can act as a drawing track. Its immediate children are alternative drawings, each of which may itself be a group combining vector, raster, masks and shading. An exposure key references a child's stable ID; it does not copy its artwork. Separate tracks can animate body, mouth, eyes, props and effects independently.

```ts
const track = panel.addGroup('Character drawings');
const anticipation = panel.addGroup('Anticipation', {}, track.id);
const action = panel.addGroup('Action', {}, track.id);
// Draw into layers inside these groups using the ordinary drawing APIs.
project.production.setDrawingSequence(track.id, [
  { frame: 0, drawingId: anticipation.id },
  { frame: 2, drawingId: action.id },
  { frame: 4, drawingId: anticipation.id },
  { frame: 6, drawingId: null },
]);
```

Frames are global, zero-based integer timeline positions. A drawing holds until the next key, switching exactly on that key's frame. Before the first key the track is blank; after the final key it holds until an enclosing visibility interval/panel boundary. Use a null drawing ID for a blank exposure. An empty schedule makes the track entirely blank. Passing null instead of a schedule removes substitution mode and restores ordinary group compositing of all children.

Keys must have unique, increasing frames. Drawing IDs must name immediate children of the track. Renaming or reordering drawings does not change the references. Masks inside a drawing retain their dependencies; a mask belonging to an inactive drawing contributes no alpha. A drawing alternative cannot itself `clipToBelow` another alternative, because alternatives are mutually exclusive. Place a clipping stack inside that drawing's group instead.

Drawing selection is distinct from transform interpolation: the group can have camera-relative depth, animated transforms, opacity and its own exposure interval. Its selected drawing can contain additional animation. An inactive drawing stays editable and stored, but is not composited. This is an exposure system, not automatic inbetweening or deformation.

## Inspect, revise and make local variants

```ts
const { keys, drawings } = project.production.drawingSequence(track.id);
// Metadata only: independent exposure rows and child ID/name/kind records.
const revised = keys!.filter(key => key.frame !== 6); // delete the blank key
revised.find(key => key.frame === 4)!.frame = 5;      // move an exposure
revised.push({ frame: 8, drawingId: null });          // add a new blank
revised.sort((a, b) => a.frame - b.frame);
project.production.setDrawingSequence(track.id, revised, {
  expectedVersion: project.version,
});
```

Replacing this small schedule is atomic and undoable. Exposure rows are addressed by frame; artwork retains stable IDs. This setter does not insert frames or extend the panel automatically. Use panel retiming when the timeline itself must change.

For a correction within a hold or across several exposure keys, use a half-open range:

```ts
project.production.setDrawingRange(track.id, 5, 8, anticipation.id);
// Frames 5, 6, 7 use anticipation; frame 8 resumes its previous drawing.
project.production.setDrawingRange(track.id, 12, 14, null); // temporary blank
```

The track must already be a drawing sequence. Frames are global nonnegative safe integers, with end greater than start. Keys inside the range are replaced; keys outside it remain. A restoration key is added at the exclusive end only when no key already exists there. This preserves blank intervals and holds beyond the last original key. Repeating the same call does not accumulate exposure keys or duplicate drawings. It changes neither panel duration nor other tracks, camera or audio. It does not automatically create a local drawing variant: use `duplicateDrawing` first when artwork must differ from its reused source. Invalid references are rejected before changing the schedule, including when the caller catches the error inside a larger transaction.

Editing a reused drawing changes every exposure referencing it. For an explicitly local correction:

```ts
const variantId = project.production.duplicateDrawing(
  track.id, anticipation.id, 'Corrected hand at frame five',
);
const exposures = project.production.drawingSequence(track.id).keys!;
exposures.find(key => key.frame === 5)!.drawingId = variantId;
project.production.setDrawingSequence(track.id, exposures);
// Find/edit the variant's layers and elements; the source drawing stays independent.
```

Duplication copies that drawing subtree and gives its layers/elements fresh IDs; it remaps internal masks and nested drawing references. An external mask dependency must be included in the drawing before duplication. Duplicating artwork is explicit; adding another exposure is only a reference. Removing a referenced drawing is rejected until its exposure references are replaced or removed. Removing the whole track removes its schedule and drawings together.

Existing component capture is static artwork capture and rejects an entire drawing sequence. Capture an individual drawing instead; animated component libraries are not implemented. Panel duplication preserves schedules, remaps drawing references and shifts their global frames with the duplicated panel. Ripple retiming maps exposure positions with the same frame mapping as other animation; it rejects collapsed keys atomically instead of silently discarding them. Panel ordering also shifts exposure keys. Audio follows the existing ripple rules without time stretching.

## Render and persistence proof

Use `renderFrameSheet` to inspect a chosen sequence of timeline frames side by side:

```ts
import {renderFrameSheet} from 'codeboard-studio';
const png = await renderFrameSheet(project, [72, 75, 78, 81, 84, 87], {
  columns: 3, thumbnailWidth: 320,
});
```

Frames are global nonnegative integers and must exist on the timeline. Caller order and repeated frames are preserved. Each card is labelled with its frame number. The sheet uses the movie frame renderer, including camera, drawing substitutions, animated layers and transitions, without motion annotations. It returns a PNG for visual review; it neither rates drawing quality nor edits exposures. Unlike onion skin it shows the entire composed frame rather than isolated tinted layers. Defaults are four columns and 320-pixel thumbnails; output is limited to 32 megapixels, so split long reviews into batches. Transparent frames are displayed against the sheet's paper background. Project input snapshots only the active panels needed for each requested frame; it does not first clone the entire project. Rendering still loads the selected panels' artwork.

For drawing-aware onion skins, `production.drawingNeighbors(trackId, frame, {skipBlank: true})` returns only three metadata records: `current`, `previous` and `next`. Each has `startFrame`, exclusive `endFrame` and `drawingId`; unavailable neighbors are null. The intervals are clipped to the owning panel and adjacent keys selecting the same drawing are combined. By default, blank intervals are skipped when finding neighbors, but a blank current exposure is still reported. Pass `skipBlank: false` to inspect adjacent blanks too. Frames outside the owning panel are rejected. This reads the exposure schedule without cloning artwork or returning the whole project.

```ts
const neighbors = project.production.drawingNeighbors(track.id, frame);
const ghosts = [neighbors.previous, neighbors.next].flatMap((interval, i) =>
  interval ? [{panelId: panel.id, frame: interval.startFrame,
    layerIds: [track.id], tint: i === 0 ? '#df675f' : '#5895dc', opacity: .5}] : []);
if (ghosts.length) await renderOnionSkin(project, ghosts, {camera: false});
```

These are exposure neighbors, not semantic pose analysis: the same drawing reused after an intervening blank or another drawing can be a neighbor. The inspection does not evaluate ancestor visibility, masks, transforms or nested tracks; the renderer still applies those when drawing the requested frame. It does not synthesize an inbetween. Use a specific frame inside a returned interval when you want to inspect animated transforms during a held drawing.

`renderPanelPNG`, frame rendering, cached render sessions, onion skin and movie export all use the same drawing evaluator. `evaluateDrawing(sequence, frame)` returns the active drawing ID or null for a blank; undefined denotes an ordinary group without a sequence. Use nonnegative integer frames and a validated, ordered sequence. A render session is a frozen snapshot: create a new session after edits.

The SQLite project stores the exposure schedule alongside group metadata and retains each drawing once. It does not serialize a project snapshot per frame. Single-panel loading retains the schedule; save/open preserves the rendered result.
