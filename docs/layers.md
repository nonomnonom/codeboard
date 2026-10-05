# Layers and composition

![Silhouette, unclipped highlights and highlights clipped to the preceding silhouette](../website/public/art/guides/clipping.png)

Compare the middle and right panels: only `clipToBelow` changes. Both layers belong to the same sibling stack. [Run the visual studies](visual-examples.md).

The snippets use a `project` and `panel` created in [project concepts](concepts.md#from-a-project-to-a-mark). Create artwork before applying operations to its IDs; a new group is empty until you add child layers and elements.

Use layers to separate roughs, clean-up, paint, and reusable parts of a character. A group can contain raster layers, vector layers, or other groups.

```ts
const character = panel.addGroup('Character', { id: 'character' });
const rough = panel.addRasterLayer('Rough', { opacity: .3 }, character.id);
const ink = panel.addVectorLayer('Ink', {}, character.id);
const shade = panel.addRasterLayer('Shading', {
  blendMode: 'multiply', opacity: .6,
}, character.id);
```

Layers render in their stored order, with later layers over earlier ones. Group transforms and opacity affect their children.

For full input shapes, see `LayerOptions`, `LayerChanges`, `Transform`, and `Pivot` in [API types](api-types.md).

## Move, rotate, or hide a layer

```ts
character.set({ transform: { x: 80, y: 0, scaleX: 1, scaleY: 1, rotation: .1 } });
rough.set({ visible: false });
shade.set({ opacity: .4 });
```

Rotation is in radians. Set a layer `pivot` to control its rotation and scale origin. The base transform places artwork; [keyframes](animation.md) change placement over time.

## Select specific artwork

```ts
project.select({ panelId: panel.id, layerId: ink.id, elementIds: [contourId] })
  .transform({ x: 20, y: -10 });
```

An element selection changes those elements' placement. Selecting the layer without element IDs changes the layer. Use `layer.edit(id, updater)` to change source geometry instead of moving the whole element.

## Clip and mask

`clipToBelow: true` clips a layer to the preceding layer's alpha. Use it for shading or highlights that should remain inside a painted silhouette.

```ts
const silhouette = panel.addVectorLayer('Silhouette');
// Draw the silhouette into this layer before adding the highlights.
const highlights = panel.addRasterLayer('Highlights', { clipToBelow: true });
```

For an explicit mask, set `maskLayerId` to another layer in the same sibling stack. The mask's alpha controls visibility. Clear a mask with `layer.set({ maskLayerId: null })`. Masks and clipping are compositing operations; the source artwork remains editable.

Supported blend modes are `source-over`, `multiply`, `screen`, `overlay`, `darken`, and `lighten`.

## Apply an ordered effect stack

```ts
character.set({ effects: [
  { kind: 'saturation', amount: 0.6 },
  { kind: 'contrast', amount: 1.15 },
  { kind: 'brightness', amount: 0.9 },
  { kind: 'hue-rotate', degrees: 12 },
] });
// Clear the stack without changing source artwork or palette bindings.
character.set({ effects: [] });
```

`LayerOptions.effects` accepts the same stack at creation. For shot animation, use
`{op: 'layer.set', layerId, changes: {effects: [...]}}` through the existing shot edit/plan
workflow. Effects persist with layers, including group/component source trees. They do not
rewrite source colors, palette references or drawing geometry. Color-effect amounts are finite numbers from
0 through 10, with 1 meaning unchanged; hue rotation is in degrees from -360 through 360,
with 0 meaning unchanged. At most 16 effects are accepted per layer. Unknown kinds and fields
reject at the schema boundary. Array order is evaluation order and can change the result.
Every slot runs as a separate filter pass, including repeated kinds; two brightness slots do
not overwrite each other. Intermediate results use the current 8-bit backend, so combining
two slots into a mathematically equivalent single filter need not be pixel-identical.

The compositor filters the completed layer after artwork/mesh rendering and its explicit mask,
then applies sibling clipping, layer opacity and blend. Group effects operate on the composed
children; child effects run first. These color effects preserve alpha. A mask layer's color
effects consequently do not change its alpha mask. Layers without effects retain the existing
direct-render path; filtered layers use an isolated surface so overlapping marks are graded
together. The clipping study includes color grades and blur comparisons for inspection when run.

Evaluation uses the installed [Skia Canvas filter API](https://skia-canvas.org/api/context)
and the existing 8-bit surfaces. For multiple image inputs, use the
[shot compositing graph](export.md#composite-shot-passes-with-a-typed-graph), which shares this
effect evaluator. Neither path provides a linear-light/HDR pipeline or LUT/ICC transform. Older engine versions do not understand
the new layer field and may discard it; keep the authoring engine pinned when sharing projects.

### Blur a layer or group

```ts
character.set({ effects: [{ kind: 'blur', amount: 4 }] });
```

Blur `amount` is a Gaussian standard deviation from 0 through 128 in the current composition
surface's logical units; 0 leaves the image unchanged. The renderer scales it by that surface's
sampling resolution. Blur runs after layer/ancestor placement within that surface, so scaling
an individual layer does not scale its blur amount. Camera-plane placement happens afterward.
Inside a deformed group's texture, units are the group's bind-space units and the filtered
child result subsequently deforms with that texture. Applying blur to the deformed group itself
instead filters its warped result. An effective standard deviation above 512 surface pixels
rejects with `RESOURCE_LIMIT` before allocating the layer's source/output surfaces.

Blur spreads color and alpha, including a mask layer's alpha. A layer's own mask is applied
before its blur, so the blurred result can spread past that mask edge. Sibling clipping runs
after effects and cuts the blurred result to the preceding sibling's alpha. For a sharp outer
mask around blurred content, place the content in a masked parent group. For each blur, the
renderer adds a finite sampling margin of `ceil(4 * sigma)` pixels per side, summed across
the stack. It renders artwork and masks into the expanded surface, evaluates the filters,
then crops to the requested bounds. Nested groups add their margins recursively. This allows
nearby offscreen artwork to contribute without changing output dimensions or placement.
Expanded surfaces remain subject to the 32-megapixel budget and reject rather than reduce
quality silently. Large blur stacks can therefore exceed the budget even on a smaller frame.

Gaussian support is approximated by this finite margin; backend pixel equivalence still needs
qualification. Mesh triangles remain the domain of mesh-warped geometry: child blur can sample
outside a bind texture before cropping, but does not extend the mesh's triangle coverage. Put
blur on the mesh-bound group itself to spread its warped silhouette. The clipping consumer
includes an offscreen red mark for comparing zero blur with the edge contribution from blur.

### Cast a colored shadow

```ts
character.set({ effects: [{
  kind: 'shadow', amount: 4, offsetX: 12, offsetY: 8,
  color: { r: 20, g: 24, b: 32 }, opacity: 0.6,
}] });
```

Shadow casts the current layer/group surface's alpha silhouette behind that surface, retaining
the original image. `amount` controls the backend drop-shadow blur from 0 through 128; zero
produces a hard shadow. Offsets are signed composition-surface units from -4096 through 4096,
following the same placement/resolution rules as blur. RGB channels are explicit integers
from 0 through 255; shadow opacity is from 0 through 1 and does not change the original image's
opacity. Color is static; blur, offsets and opacity can be animated independently. This is a
2D silhouette shadow, with no inferred lights, scene depth, receiving geometry or occlusion.

The shadow sees the layer's explicit mask and earlier effects. Later effects process the image
and its shadow together. Sibling clipping applies afterward; a parent mask can cut both. Two
shadow slots run sequentially, so the second also sees the first shadow's alpha. To cast from
the combined child silhouette, apply the effect to their group. For mesh-warped artwork, put
shadow on the bound group to cast from its warped result; child effects still obey triangle
coverage. Shadow colors do not create or modify palette bindings.

The renderer expands each side by `ceil(max(abs(offsetX), abs(offsetY)) + 4 * amount)` in
surface pixels, summed with other effects' margins before cropping. Effective blur over 512
pixels or either effective offset over 4096 pixels rejects before allocating the layer surface;
the expanded surface must also fit the 32-megapixel budget. These are conservative finite
sampling bounds, not infinite Gaussian support. The clipping study includes hard, soft,
opposite-direction and offscreen-source cases for later pixel inspection.

### Animate effect parameters

Use the existing layer keyframe API. `effectValues` addresses zero-based positions in the
effect stack; without `channel`, its value replaces `amount` or `degrees` for that effect:

```ts
project.production.addLayerKeyframe(character.id, 0, {
  effectValues: [{ index: 0, value: 0, easing: 'ease-in-out' }],
});
project.production.addLayerKeyframe(character.id, 23, {
  effectValues: [{ index: 0, value: 1 }],
});
```

For shot-local keys, put the same `effectValues` on `layer.key.put` with an explicit key ID,
frame, `transform: {}` and `easing`. Existing keys may combine transforms and effects.
Each slot interpolates independently using the outgoing entry's easing, falling back to its
keyframe easing. Before/after its first/last key it holds the nearest keyed value. An unkeyed
slot uses its static value. Key entries must have unique index/channel pairs, existing effect slots and
values within that effect's range. Hue values interpolate numerically, without shortest-arc
wrapping. Shared easing supports hold, linear, ease-in-out and bounded cubic Bezier.
Negative hue is converted to its equivalent nonnegative angle only at the backend boundary,
after interpolation. Unit-bearing filter values use decimal notation so very small animated
blur/hue values cannot be misread as an exponent by the backend's CSS parser.

Shadow additionally supports `channel: 'offsetX' | 'offsetY' | 'opacity'`. Named channels
reject on other effect kinds. Each channel has independent keys, endpoint holds and easing;
an omitted channel uses its static field. Up to 64 values may share one layer keyframe, enough
for four parameters across 16 shadow slots:

```ts
project.production.addLayerKeyframe(character.id, 0, {
  effectValues: [
    { index: 0, value: 2 }, // shadow blur amount
    { index: 0, channel: 'offsetX', value: -12 },
    { index: 0, channel: 'offsetY', value: 4 },
    { index: 0, channel: 'opacity', value: 0.3 },
  ],
});
project.production.addLayerKeyframe(character.id, 23, {
  effectValues: [
    { index: 0, value: 6 },
    { index: 0, channel: 'offsetX', value: 12 },
    { index: 0, channel: 'offsetY', value: 10 },
    { index: 0, channel: 'opacity', value: 0.7 },
  ],
});
```

Board add/update replaces the supplied `effectValues` array; omitting it preserves the old
entries. Supply all entries to retain at that frame. An empty array clears the effect values
only when another property remains authored; remove an effects-only key with the normal key
removal API. Removing transform channels preserves effects on the same key. Reordering the
stack requires remapping its indexed keys; clearing a referenced stack rejects until those
keys are revised. Board capture, ripple/retime, FPS conversion and copying move the existing
keyframe records, so effect timing follows them and uses their collision checks. The frame-job
study authors saturation and shadow blur/offset/opacity transitions before rendering master/review jobs.

## Change stacking and parenting

```ts
project.production.moveLayer(shade.id, ink.id);
project.production.reparentLayer(ink.id, character.id);
```

`moveLayer` places a layer before another sibling; omit the destination to move it to the end of its stack. `reparentLayer` changes its group; use `null` for the panel root and `beforeLayerId` to choose the destination stack position. Reparenting changes the coordinate hierarchy, so review placement when parent transforms differ. Mask and drawing-sequence relationships must remain valid.

`production.removeLayer(id)` removes a layer and its descendants. A selection's `remove()` deletes selected elements or its selected layer. Review locks block changes by other actors; deleting locked artwork requires releasing the lock first. Use a transaction for related changes and render before saving.

## Partial transforms and pivots

Layer transforms contain X/Y translation, X/Y scale and radian rotation. Negative scale can mirror artwork. A layer pivot is in local coordinates. An element selection composes an affine placement matrix; a contour edit instead changes source coordinates. Those operations produce different future rotation and scaling behavior.

When feedback refers to a visible screen location, use [coordinate conversion](math.md#convert-between-spaces) at the relevant frame. Parent transforms, animation and camera placement all contribute to that mapping.

## Find a layer in a later session

```ts
const matches = project.production.find({ panelId: panel.id, name: 'Ink', kind: 'vector', limit: 10 });
console.log(matches);
const match = matches[0];
if (!match) throw new Error('No matching Ink vector layer found');
const layer = project.production.layer(match.id);
```

Read the returned IDs and kinds before editing. Names can change; retain stable IDs for repeatable revisions. See [review and revision](review.md) for a complete loop.
