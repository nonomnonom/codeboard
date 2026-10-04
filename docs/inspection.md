# Finding and reading artwork

For a frame of a saved project, call `renderFramePNG(store.frameDocument(frame), frame)`. `frameDocument` reads timeline metadata and decodes just the active panel, plus the incoming panel during a dissolve/wipe. It shares frame-selection rules with the renderer, including end-exclusive timing and incoming animation sampled at its first frame. `store.frameDocument(frame, { revision: 'approved' })` uses the named revision's timing and artwork. All reads occur within one SQLite snapshot. The loopback `/frame/<frame>.png` preview uses this path.

Like `panelDocument`, this return value is a render context with full small project metadata but incomplete artwork, empty component sources and no audit log; it is not a complete editable project and must not be saved as one or passed to a full-document render session. Local component instances already own their artwork. This operation does not validate unrelated artwork: use `store.verify()` to check the whole container. It still scans all panel metadata and reads the project header; it is not an indexed constant-time seek.

`renderContactSheet(project, { panelIds: ['panel:07', 'panel:08', 'panel:09'], columns: 3, thumbnailWidth: 400 })` renders a selected sequence without changing project order. Supplied IDs are rendered in their requested order; empty lists, duplicate IDs and missing panels are errors. Omit `panelIds` for all panels in scene/shot order. Each thumbnail samples 60% through its panel, with the normal camera and animation evaluation. Use explicit frame renders or onion-skin samples for exact action timing.

The sheet's dimensions depend on the selected panel count, so selecting a sequence can stay below the 32-megapixel sheet limit without reducing thumbnail detail. That limit is checked before allocating the output canvas. This is a render selection, not a partial-storage reader: the current implementation still materializes and validates the full source document once for its render session. For a single panel loaded from disk, use `ProjectStore.panelDocument` instead.

All explicit render frames use global, nonnegative safe integers. Panel/frame PNGs, detail crops, composition guides, onion-skin samples and frozen render sessions reject fractional, nonfinite, negative or numerically unsafe frame values before rendering. Timeline rendering requires a panel exposed at that frame (end exclusive). Explicit panel review may sample outside its timeline interval to inspect held poses; layer exposure and keyframe rules still apply. This distinction lets agents compare drawings without silently clamping their requested times.

`renderOnionSkin` compares explicit panel/frame samples, including different times in the same panel:

```ts
const png = await renderOnionSkin(project, [
  {panelId: 'panel:04', frame: 156},
  {panelId: 'panel:04', frame: 168},
  {panelId: 'panel:04', frame: 185},
], {opacity: 0.35, camera: false});
```

For composition review without modifying drawing layers:

```ts
import {renderCompositionGuides} from 'codeboard-studio';
const png = await renderCompositionGuides(project, 'panel:14', {
  frame: 708,
  thirds: true,
  safeInset: 0.05,
  horizonY: 302,
  vanishingPoints: [{x: 872, y: 302}],
});
```

To inspect animation at a global timeline frame, use the same evaluators as the renderer:

```ts
import { evaluateLayer, evaluateCamera } from 'codeboard-studio';
const layer = project.production.layer(layerId);
const frame = 120;
const state = evaluateLayer(layer, frame); // local transform and opacity
const overview = project.production.inspect();
const shot = overview.scenes.flatMap(scene => scene.shots).find(shot => shot?.id === shotId);
if (!shot) throw new Error(`Shot not found: ${shotId}`);
const camera = evaluateCamera(shot.cameraKeyframes, frame);
```

These are interpolated local properties, not a flattened screen transform or a visibility query. Parent transforms/opacity, layer visibility and exposure, masks, and camera depth still affect the rendered result. Layer properties now have [independent keys and easing](animation-channels.md): only keys containing that property define its curve. Unkeyed properties use the layer base value. Before the first key and after the last key of a property, its nearest value holds; outgoing easing controls each interval. `hold` switches at the next property's key frame. Tests compare evaluated linear, ease-in-out and hold values to actual rendered pixels before, between and after keys, including opacity and depth-dependent camera translation. This covers these properties, not every combination of compositing and animation.

```ts
const matches = project.production.find({
  panelId: 'panel:06', name: 'palm-contour', kind: 'vector-path',
  limit: 20, offset: 0,
});
// Each row: id, kind, name, and available panelId/parentId.
const element = project.production.element(matches[0].id);
// Request the complete owning layer only when its other artwork is needed:
const layer = project.production.layer(matches[0].parentId);
```

`find` reads metadata directly from the live authoring document. It does not clone the whole project, copy brush tips/pixels or return stroke samples. The default page is 50 rows; the maximum is 200. `limit` must be a positive safe integer and `offset` a nonnegative safe integer. Larger valid limits are capped at 200. Name matching is case-insensitive substring matching; kind and panel ID are exact. An empty result means no matching rows remain at that offset.

Results follow document order: panels and their depth-first layers/elements, then component sources, assets and brush presets. A panel filter skips other panels and excludes global resources. Component source rows have no panel ID; parent IDs distinguish them from local instances. Paging is stable while the project is unchanged; capture/check `project.version` if edits may occur between pages. Search is a traversal, not a maintained in-memory index, so a high offset or a missing match may still scan many metadata entries.

Returned rows are independent metadata objects. `production.layer(id)` intentionally returns a complete independent copy of that specific panel or component-source layer, including its artwork/children, for detailed editing decisions. It no longer clones unrelated panels. For source-pixel inspection use `layer.readPixels(elementId, region)` to avoid copying an entire surface. `production.inspect()` copies only its metadata result: scene/shot structure, timing, assets, audio decisions, locks, open comments and capabilities. It traverses panel timing but does not clone artwork, components or brush arrays. Its metadata lists are complete, not paginated. `toJSON()` remains an explicit full-document snapshot; other older inspection methods may still use it.

For disk-backed inspection without opening the full authoring document, use `ProjectStore.findObjects`, `readPanel` or `panelDocument`. Store search indexes panel objects; its ordering and global-resource coverage differ from live `production.find`.

`production.element(id)` returns one independent drawing element, searching panel artwork and component sources by stable ID. It copies only the requested element, including its path commands, stroke samples/brush snapshot or raster pixels; it does not copy the owning layer or unrelated artwork. Missing IDs and IDs belonging to layers rather than drawing elements throw `Drawing element not found: <id>`. This is a read operation: editing its return value does not edit the project. Use the existing layer editing methods to apply a revision. A large individual raster surface or stroke can still have a large payload; use `readPixels` with a region for pixel crops. Search traverses metadata and is not an indexed constant-time lookup.

`production.changesSince(version, { limit, offset })` scans the audit log and copies a bounded page of entries newer than the supplied version. `production.brush(id)` copies only the requested preset, including its tip and texture dependencies. Neither reads or clones panel artwork. Returned nested values are independent: editing an audit entry or bitmap tip does not mutate the project. Audit pages default to 50 entries and are capped at 200. `offset` skips matching entries in audit order. The version must be a nonnegative safe integer. This is an intentional development API change: callers needing all matching changes must page through them. The limit bounds entry count, not the byte size of an unusually large individual change record.

Production operations no longer call `toJSON()` internally. Transition duration is checked against the live panel inside the mutation, before assignment; unlocking reads only the specific lock before checking ownership and the expected version. This removes redundant inspection snapshots, not transaction snapshots: broad production mutations still use the rollback and full-document validation described in [storage](storage.md).

## Pagination contract

Live object search, stored object search, named revision listing and audit reads use the same pagination validation. `limit` defaults to 50 and must be a positive safe integer; values above 200 are capped at 200. `offset` defaults to zero and must be a nonnegative safe integer. Fractions, NaN and infinity fail with an explicit query error rather than being truncated or passed into SQLite. Offset is relative to matching results, not the complete document. Stored object ordering remains different from live object traversal, as described above.

```ts
const changes = [];
for (let offset = 0; ; offset += 200) {
  const page = project.production.changesSince(startVersion, { limit: 200, offset });
  changes.push(...page);
  if (page.length < 200) break;
}
```

This loop deliberately collects the full matching audit log; use one page when bounded tool output is needed. Keep the project unchanged while traversing pages if a consistent set is required. Returned entries are independently owned, and paging does not clone artwork. Audit lookup scans metadata rather than using an index. Named-revision and object queries on disk retain their existing SQLite indexes and avoid artwork decode.

The CLI accepts the same bounds: `node dist/src/cli.js inspect project.cboard --panel panel:06 --limit 3 --offset 2`. Tests use 235 actual audit revisions and 235 searchable drawing elements to verify limits, the final page, empty pages, independent ownership and consistent invalid-input handling. The CLI was also run against the saved flagship. `production.inspect().capabilities` now identifies Gaussian selection feathering and explicit pressure-stroke outline conversion alongside the existing drawing operations.
