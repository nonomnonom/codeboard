# Edit shot layers and keyframes

Use these operations for artwork inside a shot animation. They use shot-local frames; storyboard layer handles use board frames.

To insert a complete character into an existing shot, use [character instances](reusable-characters.md). This preserves the destination set and camera while copying the character's editable rig and local performance.

## Edit local animation channels

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

## Construct and reorganize shot layers

`animation.edit`/`editShotAnimation` also accept:

- `layer.add`: explicit `id`, `kind` (`raster`, `vector`, `group`), `name`, optional layer `options`, optional group `parentId` and sibling `beforeId`. Creates an empty layer; omitted parent means the root and omitted insertion target appends. Options accept signed local exposure times.
- `layer.move`: `layerId`, explicit `parentId` (null for root), optional `beforeId`. Reorders/reparents with local transforms unchanged; this does not preserve world-space placement automatically. Parenting under self/descendants rejects. Moving before itself within the same parent is a no-op.
- `layer.remove`: `layerId`; removes the subtree.
- `layer.rig`: group `layerId` and a two-bone `definition`, or null to unbind.
- `layer.depth`: root `layerId` and positive `depth`.

Later operations address the hierarchy produced by earlier ones. Final validation rejects dangling masks, drawing selections, invalid rig elbows and nested keyed depth planes; revise dependent bindings in the same batch. Project review anchors and locks are preserved, so removal that would orphan them rejects. Resolve/re-anchor/remove those records explicitly rather than losing them during topology edits. New IDs must be globally unique.

Fill a drawing layer with `project.addShotElement(animationId, layerId, element)`, supplying a complete editable element with a stable ID. `removeShotElements(animationId, layerId, ids)` removes a nonempty set of unique IDs from that layer. Both reuse project transactions, type compatibility, global identity and reference validation. Plan equivalents are `animation.element.add` (encode its element using `planShotElement`) and `animation.element.remove`. Raster plans retain the 1 MiB total plan budget; the SDK can author larger surfaces directly.
