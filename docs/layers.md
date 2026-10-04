# Layers and composition

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

## Find a layer in a later session

```js
const matches = project.production.find({ panelId: panel.id, name: 'Ink', limit: 10 });
console.log(matches);
const layer = project.production.layer(matches[0].id);
```

Read the returned IDs and kinds before editing. Names can change; retain stable IDs for repeatable revisions. See [review and revision](review.md) for a complete loop.
