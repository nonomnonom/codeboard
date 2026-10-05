# Pixel surfaces and selections

![Hard triangle selection compared with eight-pixel feathering](https://codeboard.nonom.xyz/art/guides/selections.png)

The shape and fill color are unchanged. The right sample feathers selection coverage before filling. [Run the visual studies](visual-examples.md).

Start with a project and panel from [project concepts](concepts.md). These are separate recipes: the import and polygon examples both declare `image` and `surfaceId`, so choose one rather than pasting both declarations into the same scope. For the polygon recipe, first create `const paint = panel.addRasterLayer('Pixels')`.

A raster surface stores editable RGBA pixels. It differs from a replayable brush stroke: changing a surface edits pixel values, while changing a stroke changes pen samples and brush settings that are painted again.

## Import an image as editable pixels

```js
import { readFile } from 'node:fs/promises';
import { decodePixels } from 'codeboard-studio';
const image = await decodePixels(await readFile('texture.png'));
const paint = panel.addRasterLayer('Texture');
const surfaceId = paint.rasterSurface(image, {
  name: 'Paper texture', opacity: .4,
  matrix: [1, 0, 0, 1, 120, 80],
});
```

Pixels use straight-alpha, sRGB RGBA8: four bytes per pixel, row by row. `matrix` places source pixels in the layer's coordinates. Keep image-resolution coordinates separate from panel or camera coordinates. Importing a flat image does not infer separate objects, depth, or character joints.

## Fill a polygon selection

```js
import { createPixels, polygonPixelSelection, featherPixelSelection, fillPixels } from 'codeboard-studio';
const image = createPixels(256, 256);
const polygon = polygonPixelSelection(256, 256, [
  { x: 30, y: 210 }, { x: 90, y: 40 }, { x: 225, y: 170 },
]);
const selection = await featherPixelSelection(polygon, 2);
fillPixels(image, [244, 129, 54, 255], { selection });
const surfaceId = paint.rasterSurface(image);
```

Coverage uses one byte per source pixel: 0 excludes it and 255 fully selects it. `featherPixelSelection` is asynchronous and uses a blur sigma in source pixels; zero disables feathering. Polygon fill rules are `nonzero` and `evenodd`.

## Select by color or combine masks

```js
import { colorPixelSelection, combinePixelSelections, invertPixelSelection } from 'codeboard-studio';
const color = colorPixelSelection(image, 100, 100, { tolerance: 24, contiguous: true });
const intersection = combinePixelSelections(selection, color, 'intersect');
const outside = invertPixelSelection(intersection);
```

The seed must be inside the image. `contiguous: true` follows connected matching pixels; `false` considers matching pixels throughout the surface. Combine masks of equal dimensions with `union`, `intersect`, or `subtract`.

## Edit a bounded region

```js
paint.editPixels(surfaceId, { x: 40, y: 40, width: 80, height: 60 }, patch => {
  fillPixels(patch, [0, 0, 0, 80], { mode: 'destination-out' });
});
```

The callback receives a patch-local pixel buffer. Coordinates inside it start at `(0, 0)`. `source-over` paints, `copy` replaces, `destination-out` erases by alpha, and `source-atop` paints within existing alpha. `readPixels` returns a copy; use `editPixels` to persist changes through the project.

For standalone buffers, `readPixelRegion` and `writePixelRegion` read and write patches. `encodePixels` returns PNG bytes. Layer transforms do not change the underlying surface resolution.

## Measure a revision

```js
import { comparePixels } from 'codeboard-studio';
const difference = comparePixels(beforeImage, afterImage, { threshold: 2 });
console.log(difference.changedPixels, difference.bounds);
```

Images must have equal dimensions. The comparison accounts for alpha and reports changed-pixel bounds, maximum channel difference, and mean absolute difference. A small numeric difference is evidence of changed pixels, not proof that an illustration improved.
