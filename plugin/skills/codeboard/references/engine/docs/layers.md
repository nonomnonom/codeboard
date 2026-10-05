# Layers and composition

![Silhouette, unclipped highlights and highlights clipped to the preceding silhouette](https://codeboard.nonom.xyz/art/guides/clipping.png)

Compare the middle and right panels: only `clipToBelow` changes. Both layers belong to the same sibling stack. [Run the visual studies](visual-examples.md).

The snippets use a `project` and `panel` created in [project concepts](concepts.md#from-a-project-to-a-mark). Create artwork before applying operations to its IDs; a new group is empty until you add child layers and elements.

Use layers to separate roughs, clean-up, paint, and reusable parts of a character. A group can contain raster layers, vector layers, or other groups.

```js
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

```js
character.set({ transform: { x: 80, y: 0, scaleX: 1, scaleY: 1, rotation: .1 } });
rough.set({ visible: false });
shade.set({ opacity: .4 });
```

Rotation is in radians. Set a layer `pivot` to control its rotation and scale origin. The base transform places artwork; [keyframes](animation.md) change placement over time.

## Select specific artwork

```js
project.select({ panelId: panel.id, layerId: ink.id, elementIds: [contourId] })
  .transform({ x: 20, y: -10 });
```

An element selection changes those elements' placement. Selecting the layer without element IDs changes the layer. Use `layer.edit(id, updater)` to change source geometry instead of moving the whole element.

## Clip and mask

`clipToBelow: true` clips a layer to the preceding layer's alpha. Use it for shading or highlights that should remain inside a painted silhouette.

```js
const silhouette = panel.addVectorLayer('Silhouette');
// Draw the silhouette into this layer before adding the highlights.
const highlights = panel.addRasterLayer('Highlights', { clipToBelow: true });
```

For an explicit mask, set `maskLayerId` to another layer in the same sibling stack. The mask's alpha controls visibility. Clear a mask with `layer.set({ maskLayerId: null })`. Masks and clipping are compositing operations; the source artwork remains editable.

Supported blend modes are `source-over`, `multiply`, `screen`, `overlay`, `darken`, and `lighten`.

## Change stacking and parenting

```js
project.production.moveLayer(shade.id, ink.id);
project.production.reparentLayer(ink.id, character.id);
```

`moveLayer` places a layer before another sibling; omit the destination to move it to the end of its stack. `reparentLayer` changes its group; use `null` for the panel root and `beforeLayerId` to choose the destination stack position. Reparenting changes the coordinate hierarchy, so review placement when parent transforms differ. Mask and drawing-sequence relationships must remain valid.

`production.removeLayer(id)` removes a layer and its descendants. A selection's `remove()` deletes selected elements or its selected layer. Review locks block changes by other actors; deleting locked artwork requires releasing the lock first. Use a transaction for related changes and render before saving.

## Partial transforms and pivots

Layer transforms contain X/Y translation, X/Y scale and radian rotation. Negative scale can mirror artwork. A layer pivot is in local coordinates. An element selection composes an affine placement matrix; a contour edit instead changes source coordinates. Those operations produce different future rotation and scaling behavior.

When feedback refers to a visible screen location, use [coordinate conversion](math.md#convert-between-spaces) at the relevant frame. Parent transforms, animation and camera placement all contribute to that mapping.

## Find a layer in a later session

```js
const matches = project.production.find({ panelId: panel.id, name: 'Ink', kind: 'vector', limit: 10 });
console.log(matches);
const match = matches[0];
if (!match) throw new Error('No matching Ink vector layer found');
const layer = project.production.layer(match.id);
```

Read the returned IDs and kinds before editing. Names can change; retain stable IDs for repeatable revisions. See [review and revision](review.md) for a complete loop.
