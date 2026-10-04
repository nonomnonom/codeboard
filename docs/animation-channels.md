# Independent layer animation properties

Layer keyframes store the properties actually authored at a frame. X, Y, X/Y scale, rotation, opacity and root-plane depth each interpolate between their own keys. An opacity-only key does not insert a position, scale, rotation or depth key. Properties with no keys use the layer's base value; before/after a property's first/last key, that property's nearest value holds.

```ts
project.production.addLayerKeyframe(layerId, 0, {
  transform: { x: 0 }, easing: 'ease-in-out',
});
project.production.addLayerKeyframe(layerId, 24, { transform: { x: 180 } });
project.production.addLayerKeyframe(layerId, 0, { opacity: 1, easing: 'linear' });
project.production.addLayerKeyframe(layerId, 12, { opacity: .3 });
project.production.addLayerKeyframe(layerId, 24, { opacity: 1 });
```

The opacity key at frame 12 leaves the X curve unchanged. Rotation is in radians and interpolates numerically, including authored multiple turns; it does not automatically choose a shortest angular path. Scale can cross zero; coordinate inversion can therefore become unavailable at a singular frame.

## Authoring contract

`addLayerKeyframe` authors only supplied properties. It does not fill unspecified properties from a complete base-layer transform/opacity snapshot. A new key requires at least one property. Adding at an occupied frame merges supplied properties and preserves the existing key ID. It also preserves the easing of untouched properties. An explicit `easing` on that call applies to the properties supplied by that call; new keys default to linear. Repeating the same authoring call does not accumulate duplicate keys. Successful mutations still create audit entries and advance project version.

Stored keys contain a partial `transform`, optional `opacity` and `depth`, default outgoing `easing` and optional `channelEasing` overrides. Overrides may only target properties keyed at that frame. This permits a held rotation and linear fade starting on the same frame. Easing accepts `linear`, `ease-in-out` (smoothstep), `hold`, or a normalized cubic Bezier segment as described below.

Depth keys must be positive and finite and belong to a top-level plane. Author them with `addLayerKeyframe(rootId, frame, {depth: 2, easing: 'ease-in-out'})`, inspect the evaluated value through `evaluateLayer(...).depth`, and remove them with the `'depth'` channel. Remove depth keys before reparenting the plane under another group. Changing the base depth with `setPlaneDepth` does not override existing depth keys. See [multiplane semantics and review](transforms.md).

Existing full-value keys really key every included property. The engine does not guess which properties were intended to be static. To separate a channel from such a key, remove that channel explicitly. No parallel legacy evaluator or migration adapter is used.

`updateLayerKeyframe` retains its targeted-ID behavior. A supplied `transform` replaces the properties authored by that key's transform; it is not merged. Unspecified top-level fields remain unchanged. `channelEasing` replaces the override map when supplied. Changing default `easing` applies to owned channels without overrides. The key ID remains stable when its frame changes. Frame collisions and invalid values fail before assignment.

Camera keys now author independent X, Y, zoom and rotation properties, using the same per-property evaluation rule. Re-adding at an occupied frame merges supplied properties and preserves the key ID and untouched easing. Unkeyed camera properties default to X=0, Y=0, zoom=1, rotation=0. Existing complete-state keys continue to key every included property; remove unwanted channels explicitly. Skew, animated pivot channels, 3D rotation and deformation rigs are outside this implementation. Static [layer pivots](transforms.md) are supported.

## Inspect and edit one channel

```ts
const page = project.production.layerKeyframes(layerId, { limit: 50, offset: 0 });
const key = page.find(key => key.frame === 12)!;
project.production.removeLayerKeyframeChannels(layerId, key.id, ['opacity']);
```

Inspection traverses metadata and copies only the requested keyframe page, sorted by frame. It does not clone layer artwork or the project. The shared pagination contract defaults to 50 keys, caps a page at 200, and rejects invalid offsets/limits. Returned values are independent. Use `evaluateLayer(layer, frame)` for fully evaluated local values, or `production.coordinates` for the composed frame-space matrix.

`removeLayerKeyframeChannels` removes only the named authored properties and their easing overrides. The key keeps its ID while any property remains; removing the last property removes that key. Empty/duplicate/unknown channel names or channels not present on the key fail atomically. Use a transaction to combine removal, a new property key and related edits into one undo operation. Whole-key move/delete, save/open, partial panel loading, duplication and ripple retiming continue to operate on these keys. Retiming rejects collisions rather than merging key identities or discarding values.

## Custom timing handles

```ts
project.production.addLayerKeyframe(layerId, 0, {
  transform: { rotation: -.15 },
  easing: { type: 'cubic-bezier', x1: .15, y1: 0, x2: .3, y2: 1 },
});
project.production.addLayerKeyframe(layerId, 24, { transform: { rotation: .2 } });
```

The outgoing segment runs from `(0, 0)` to `(1, 1)`. X represents normalized time and Y represents normalized progress between the property's two values. All four handle coordinates must be finite and within 0-1. The evaluator inverts the cubic X coordinate using bounded bisection, then evaluates Y at that parameter; it does not substitute elapsed time directly into the cubic parameter. Flat horizontal tangents and reversed handle X ordering are supported. Frame endpoints retain their exact authored values. Handles outside the unit square, overshoot and arbitrary multi-segment function splines are not implemented.

The same definition works in a layer key's `channelEasing` override and in a camera key's `easing`. Camera keys also accept `channelEasing` overrides through `updateCameraKeyframe`. Each sparse layer property uses its own next keyed value, so another property's intermediate key does not shorten the curve. Retiming changes frame positions while retaining normalized handles. Handles are project metadata and survive ordinary save/open and partial panel reads; no per-frame samples are stored. Inspection returns copies, and edits participate in the existing undo/transaction system.

## Evidence

Tests verify eased position through an independently keyed linear fade, rendered RGBA at a known position, same-frame property merges and IDs, per-channel removal, invalid-edit rollback, bounded metadata reads, save/open, partial reads and retiming. Numeric cubic tests use X = u cubed and Y = 3u squared - 2u cubed to verify known values, including X=.125 giving Y=.5. They also cover the opposite flat tangent, camera zoom, input ownership and undo.

Harmony documents [separate parameter function curves](https://docs.toonboom.com/help/harmony-24/advanced/motion-path/about-draw-layer.html) and [Bezier/ease velocity controls](https://docs.toonboom.com/help/harmony-24/advanced/motion-path/about-velocity.html). This implementation supplies independent curves for the six layer properties above and bounded cubic timing handles. It does not claim Harmony's complete rigging or function-editor capabilities.

## Independent camera revision

```ts
project.production.addCameraKeyframe(shotId, 0, { x: 0, easing: 'ease-in-out' });
project.production.addCameraKeyframe(shotId, 48, { x: 100 });
project.production.addCameraKeyframe(shotId, 0, { zoom: 1, easing: 'linear' });
project.production.addCameraKeyframe(shotId, 24, { zoom: 1.15 });
project.production.addCameraKeyframe(shotId, 48, { zoom: 1 });
const keys = project.production.cameraKeyframes(shotId, { limit: 50, offset: 0 });
project.production.removeCameraKeyframeChannels(shotId, keys[0]!.id, ['zoom']);
```

Camera inspection copies a bounded page of key metadata without reading artwork. Channel removal also removes its easing override; it deletes the key only when no properties remain. Invalid or duplicate channel names, absent channels, nonpositive zoom, invalid curves and frame collisions fail atomically. An empty `addCameraKeyframe` call is invalid even at an occupied frame. `updateCameraKeyframe` merges supplied top-level values; a supplied `channelEasing` map replaces the override map. Use channel removal to unkey a property.

Camera mutations now copy only the affected shot metadata, once per authoring transaction. They no longer explicitly clone panel artwork before editing camera keys. Validation still traverses the document; this is not a constant-memory or constant-time claim. Mixed camera/artwork transactions, multiple shot edits, widening to a whole-document operation, rollback and undo are tested. Saving uses the existing container's deduplicated records; this change does not introduce another storage representation.
