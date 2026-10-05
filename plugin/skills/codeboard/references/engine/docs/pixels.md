# Pixel surfaces and selections

![Hard triangle selection compared with eight-pixel feathering](https://codeboard.nonom.xyz/art/guides/selections.png)

The shape and fill color are unchanged. The right sample feathers selection coverage before filling. [Run the visual studies](visual-examples.md).

Start with a project and panel from [project concepts](concepts.md). These are separate recipes: the import and polygon examples both declare `image` and `surfaceId`, so choose one rather than pasting both declarations into the same scope. For the polygon recipe, first create `const paint = panel.addRasterLayer('Pixels')`.

A raster surface stores editable RGBA pixels. It differs from a replayable brush stroke: changing a surface edits pixel values, while changing a stroke changes pen samples and brush settings that are painted again.

## Import an image as editable pixels

```ts
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

`decodePixels` applies an explicit output ICC transform to sRGB before returning raw bytes. Fixed sRGB and Display P3 PNG fixtures exercise 8-bit and 16-bit input, alpha retention, and saved editable pixels. Imported profiles and higher channel precision are not retained in the RGBA8 surface; retain original source files when needed. Untagged RGB images are interpreted as sRGB. Decoder warnings, including damaged profiles that would otherwise be ignored, reject with `INVALID_ARGUMENT` and `details.reason: "IMAGE_DECODE_WARNING"`.

![Four normalized ICC input strips, each shown over light and dark backgrounds](https://codeboard.nonom.xyz/art/guides/color-import.png)

The [color import study](../examples/studies/src/studies/drawing/color-import.ts) produces this image, an editable project, source hashes and decoded channel values. It qualifies these input fixtures, not arbitrary ICC profiles, HDR retention or a high-precision compositor.

## Fill a polygon selection

```ts
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

```ts
import { colorPixelSelection, combinePixelSelections, invertPixelSelection } from 'codeboard-studio';
const color = colorPixelSelection(image, 100, 100, { tolerance: 24, contiguous: true });
const intersection = combinePixelSelections(selection, color, 'intersect');
const outside = invertPixelSelection(intersection);
```

The seed must be inside the image. `contiguous: true` follows connected matching pixels; `false` considers matching pixels throughout the surface. Combine masks of equal dimensions with `union`, `intersect`, or `subtract`.

## Edit a bounded region

```ts
paint.editPixels(surfaceId, { x: 40, y: 40, width: 80, height: 60 }, patch => {
  fillPixels(patch, [0, 0, 0, 80], { mode: 'destination-out' });
});
```

The callback receives a patch-local pixel buffer. Coordinates inside it start at `(0, 0)`. `source-over` paints, `copy` replaces, `destination-out` erases by alpha, and `source-atop` paints within existing alpha. `readPixels` returns a copy; use `editPixels` to persist changes through the project.

For standalone buffers, `readPixelRegion` and `writePixelRegion` read and write patches. `encodePixels` returns PNG bytes. Layer transforms do not change the underlying surface resolution.

## Import editable PSD pixels

`importPSD` reads a bounded subset of PSD v1: untagged RGB8 pixel layers and isolated groups,
with Unicode names, positions, visibility, opacity and six mapped blend modes. It returns
native layers and a source hash; it does not write files or mutate a project.

```ts
import { readFile } from 'node:fs/promises';
import { importPSD } from 'codeboard-studio';

const imported = importPSD(await readFile('artwork.psd'), {
  namespace: 'asset:background-v1',
  sourceColorSpace: 'srgb',
  lossPolicy: 'report',
});
console.log(imported.width, imported.height, imported.sourceSha256, imported.losses);
```

Choose a fresh namespace for each source to avoid project-wide ID collisions. The required
`sourceColorSpace` explicitly interprets untagged channels as sRGB; it is not an ICC conversion.
The default loss policy is `reject`. `report` permits omission of recognized non-rendering
metadata and returns its paths/reasons; it does not permit discarding unsupported artwork.

Tagged profiles, PSB, clipping, masks, pass-through groups, text, effects, smart objects and
unknown blocks reject. Raw, RLE and bounded ZIP channel data are accepted, with limits of
64 MiB input, 256 layer records, 32 megapixels of decoded layers and group depth 16. The merged
preview is ignored; rendering uses imported editable layers. PSD export is not implemented.

The [PSD study source](../examples/studies/src/studies/assets/psd-import.ts) saves the returned
layers into a native project, verifies reopen parity, changes one pixel through a persisted
plan, and checks retry behavior. Its RLE/ZIP fixtures were produced by an independent writer;
this does not claim Photoshop application interoperability for arbitrary documents.

## Measure a revision

```ts
import { comparePixels } from 'codeboard-studio';
const difference = comparePixels(beforeImage, afterImage, { threshold: 2 });
console.log(difference.changedPixels, difference.bounds);
```

Images must have equal dimensions. The comparison accounts for alpha and reports changed-pixel bounds, maximum channel difference, and mean absolute difference. A small numeric difference is evidence of changed pixels, not proof that an illustration improved.
