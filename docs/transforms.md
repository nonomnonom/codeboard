# Artwork placement and source editing

## Revising a multiplane layer

`project.production.setPlaneDepth(rootLayerId, 2, {expectedVersion: project.version})` changes the camera-relative depth of an existing top-level layer or group. Depth must be positive and finite. Child layers inherit their root plane's camera placement; this setter rejects a nested target instead of accepting a value that cannot affect the render. Find the root with `production.coordinates(targetId).rootLayerId`. The plane's artwork, local transforms and keyframes are retained; the operation is undoable and saved with the project.

The engine uses a 2D parallax model: camera pan is divided by depth and camera zoom is raised to `1 / depth`. Larger depths respond less to pan and zoom; depth 1 follows the camera directly. Depth does not sort layers or implement physical 3D perspective, occlusion, a focal plane, or Z-axis rotation. Root planes also support independent [depth keyframes](animation-channels.md). Rendering with `camera: false` ignores this placement. With a neutral camera (zero pan/rotation and unit zoom), changing depth alone has no visible effect.

Finite positive inputs can still produce an unrepresentable camera/depth combination (for example, zoom 2 with depth `1e-300`). Coordinate inspection and native rendering share a checked camera-plane calculation. Nonfinite/zero scale, nonfinite inverse scale, pan, final matrix or composition bounds fail with a numerical-range error instead of reaching native composition. The document remains editable so the agent can revise the key or camera. This checks the requested frame, not every possible future combination at authoring time; it does not clamp depth or silently alter the picture. Failed panel renders release their private output surface. Tests cover both zoom overflow and underflow, recovery after correction, and frozen-session rejection. All fourteen stored version-38 flagship panel PNGs remained byte-identical after this consolidation.

Validation note for the depth revision: the default parallel suite run passed 208 tests and timed out after five seconds in one pre-existing bitmap-brush test. Re-running the complete unchanged suite with `--maxWorkers=4` passed all 209 tests; build, typecheck, documentation links and package verification passed. Reduced concurrency avoided the observed timeout, but its cause was not independently established.

For animated depth, the suite grew to 210 tests. A four-worker run again timed out in that brush test (209 passed). The brush file passed separately, then the complete unchanged suite passed all 210 tests with `--maxWorkers=1`; the timeout and assertions were not relaxed. Build, typecheck, package verification and documentation links also passed. The underlying cause of the parallel timeout remains undiagnosed.

## Placing artwork

```ts
project.select({ panelId, layerId, elementIds: [handContour, inkStroke] })
  .transform({ x: 40, y: -12, rotation: -0.1, scaleX: 1.2, scaleY: 1.2 });
```

This places the complete selected artwork. It scales line width and brush tips, rotates text glyphs and preserves nonuniform scaling or reflection. Each element stores a six-number affine `matrix`; an absent matrix means identity. Raster surfaces always carry their matrix explicitly. Consecutive calls compose placement, so a later move acts on the already-placed artwork.

The transform applies scale, then rotation in radians, then translation. An optional temporary pivot is expressed in the selected elements' owning layer coordinates:

```ts
project.select({ panelId, layerId, elementIds: [handContour, inkStroke] })
  .transform({ rotation: -.12 }, { pivot: { x: 140, y: 160 } });
```

The pivot applies to the selection's already-placed artwork and does not change the layer's permanent pivot. Element placement remains inside its layer/group transform and the shot camera. Temporary pivots require selected element IDs; a layer-only selection rejects that option rather than silently changing its rig.

Matrix values `[a,b,c,d,e,f]` map a source point to `(a*x+c*y+e, b*x+d*y+f)`. They can be inspected with `production.layer(layerId)` and edited through `layer.edit(id, element => ...)`. They participate in save/open, undo, content deduplication and component reuse. Placement is not a timeline animation; animate the owning layer/group with keyframes when motion over time is intended.

Source paths, sampled pen points, pressure/time/tilt, brush definitions, pixel buffers and text/font settings stay editable and unchanged by placement. In particular, enlarging a stroke does not recalculate pen speed from enlarged coordinates and accidentally alter its original brush dynamics. Paper texture follows the placed artwork. Pixels remain source pixels; this does not create pose or contour information from a bitmap.

`layer.edit`, `booleanPath`, `pathContains`, `pathBounds` and pixel-region edits use the element's source coordinates. To change a hand contour, edit its source control points; to move the entire hand artwork, transform its selection. Source bounds/hit tests do not implicitly include element placement, layer transforms or camera framing.

Selecting a layer without element IDs retains the layer API's existing behavior: supplied transform fields replace those fields on the layer. Element selection instead composes the supplied delta with existing placement. Tests compare all five element representations to the equivalent Canvas affine transform, then verify source preservation, atomic rejection of invalid matrices, undo and binary save/open render equality.

## Permanent layer pivots

```ts
const head = panel.addGroup('Head', { pivot: { x: 140, y: 160 } }, torso.id);
// Add face, ink, raster shading and mask layers under head.id.
project.production.addLayerKeyframe(head.id, 0, { transform: { rotation: 0 } });
project.production.addLayerKeyframe(head.id, 12, { transform: { rotation: -.18 } });
head.set({ pivot: { x: 138, y: 158 } });
```

A vector layer, raster layer or group can store a permanent local-coordinate pivot. It defaults to `(0,0)` when absent; setting `{x:0,y:0}` returns to origin behavior. The transform is `T(position) × T(pivot) × R(rotation) × S(scale) × T(-pivot)`. Position remains an offset, not the absolute location of the pivot. With no translation, rotation and scaling leave the pivot fixed; parent transforms and the camera then place it in the frame.

This enables hierarchical cut-out joints with ordinary groups: a head follows the torso and can rotate independently, while face/ink/shading/masks follow the head. Drawing sequences can live beneath the same joint. Changing the permanent pivot affects every frame, including existing interpolated rotation/scale. It does not automatically preserve the old appearance of an already rotated/scaled layer or rewrite its animation. Pivots are not independently animated channels, inverse kinematics, bone skinning or mesh deformation.

Pivots use the same validated project data for direct and cached renders, mask ancestry, camera/depth composition and `production.coordinates`. `matrixFromTransform(transform, pivot)` provides the corresponding affine matrix for agent calculations. Values must be finite. Source paths, pixels and brush samples remain unchanged. Stored pivots participate in save/open, explicit duplication/component capture and undo; component capture still strips animation as documented separately.

Tests check fixed joint positions, nested animated parents, camera composition, vector/raster/group pixels, hidden-mask ancestry, temporary selection pivots, input ownership, invalid values, undo and reopened rendering. This follows the concept of [permanent pivots documented in Harmony](https://docs.toonboom.com/help/harmony-24/premium/rigging/about-permanent-pivot.html), without claiming its complete rigging toolset.

## Reparent existing artwork

```ts
const correction = panel.addGroup('Head correction', { pivot: { x: 140, y: 160 } }, torsoId);
project.production.reparentLayer(headId, correction.id);
project.production.addLayerKeyframe(correction.id, 0, { transform: { rotation: 0 } });
project.production.addLayerKeyframe(correction.id, 12, { transform: { rotation: -.04 } });
// Return a layer to the panel root, inserting before an existing root sibling:
project.production.reparentLayer(layerId, null, { beforeLayerId: foregroundId });
```

Reparenting moves the existing layer or entire group within its panel. It preserves all layer/element IDs, source artwork, masks, pivots, local transforms, keyframes and review anchors. It appends to the destination by default; `beforeLayerId` selects another immediate child of that destination. `null` means panel root. Only the owning panel is copied for the mutation; undo/redo and save/open retain the hierarchy.

**Local coordinates remain unchanged.** The new parent's transforms, opacity, visibility, exposure and drawing selection now apply, and root depth controls camera parallax. The frame-space appearance can therefore change. This API does not rebase animation, preserve world-space placement, or synthesize a shear transform. To retain appearance when introducing a correction group, start with an identity group at the existing parent, reparent into it, then deliberately author the correction. Moving clipping artwork changes its sibling clipping context; move a complete clipping group when that relationship must be retained.

Cross-panel moves, non-group parents, parenting into the moved subtree, invalid insertion targets and dependency cycles are rejected. A drawing referenced by its current parent's drawing sequence must be removed from that schedule before leaving the parent. An entire sequence can move with its children and schedule intact. A new child of a drawing sequence has no exposure until referenced; clipped children must travel inside their complete clipping group. Locked moved descendants or source/destination ancestors must be unlocked first. `expectedVersion` uses the same conflict contract as other production operations.

Tests cover known rendered positions under an animated parent, unchanged local curves and IDs, retained comments/masks/sequences, explicit ordering, scoped copying, failed operations caught inside a transaction, cached/direct parity, partial loading, save/open and undo.

## Refreshing a reviewed component instance

Updating a component source never silently updates its instances. `refreshComponentInstance(instanceId)` explicitly replaces the instance's child artwork with a fresh copy of the current source while retaining the instance root and its placement/animation. Local edits inside the replaced children are discarded by this operation. Child IDs are new; the engine does not infer correspondence from names or flattened geometry.

Refresh checks references before replacing children. It rejects locked descendants, outside layers using descendant masks, and drawing schedules referencing replaced children. Fix those dependencies explicitly first. Comments anchored to replaced children or elements also reject refresh by default, with their comment IDs in the error. To deliberately retain those notes at the coarser instance anchor:

```ts
project.production.refreshComponentInstance(instanceId, {
  comments: 'anchor-to-instance',
  expectedVersion: project.version,
});
```

This preserves each affected comment's ID, text, status, author, timestamps and frame/X/Y coordinates; it replaces the layer/element anchor with the instance root and its owning panel. Existing instance-root comments are unchanged. It does not claim that the note's old contour still exists or that its coordinates describe the revised shape. The default `comments: 'reject'` keeps that decision explicit. Undo restores the former artwork and exact old anchors; save/open retains the accepted new anchors and rendering.

Invalid animated-source capture/revision and incomplete mask dependencies are also checked before source assignment or ID allocation, including when the caller catches an error inside a larger transaction. Copying a valid component/drawing clones its tree once, then remaps IDs and internal references in that owned copy; it no longer recursively deep-copies each already-copied subtree again. Static component capture remains distinct from the drawing-sequence animation system.

Two-link cut-out chains can now store an elbow reference and solve target poses into ordinary rotation keys through the [two-bone rig API](rigging.md). This is separate from changing a pivot or reparenting a layer; it does not provide skinning or mesh deformation.
