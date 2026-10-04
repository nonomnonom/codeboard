# Pixel surfaces and paint replay

Raster layers may combine `raster-surface` elements and painting/eraser strokes. A surface is editable pixel artwork. A stroke retains its samples and immutable brush settings for replay. Vector paths remain editable geometry on vector layers. These representations are not interchangeable.

```ts
import { createPixels, decodePixels, encodePixels } from 'codeboard-studio';
import { readFile, writeFile } from 'node:fs/promises';

const paint = panel.addRasterLayer('Paint');
const pixels = await decodePixels(await readFile('original.png'));
const surface = paint.rasterSurface(pixels, {
  name: 'Imported wash', matrix: [1, 0, 0, 1, 120, 80],
});
paint.editPixels(surface, { x: 10, y: 20, width: 8, height: 8 }, patch => {
  for (let i = 0; i < patch.pixels.length; i += 4)
    patch.pixels.set([237, 182, 93, 180], i);
});
const detail = paint.readPixels(surface, { x: 8, y: 18, width: 16, height: 16 });
await writeFile('detail.png', await encodePixels(detail));
// For original procedural artwork, createPixels(width, height) starts transparent.
```

The buffer is a `Uint8Array`, four straight-alpha sRGB channels per pixel in RGBA order. `decodePixels` converts input to that representation; this is an explicit 8-bit conversion, not a promise to preserve original 16-bit, wide-gamut, layer or animation information. `encodePixels` emits lossless PNG. Document save/open preserves the exact source bytes, including RGB beneath transparent pixels. Rendering uses Skia's compositing and alpha handling; flattened rendered pixels do not necessarily reproduce hidden source RGB.

The six matrix values are `[a,b,c,d,e,f]`: `(x,y)` maps to `(a*x+c*y+e,b*x+d*y+f)`. Selection transforms compose with this matrix, retaining rotation, scale and shear without rewriting pixels. Layer/camera animation, masks, opacity and blending apply normally. Pixel regions always address the original buffer, not the transformed screen. Reads return copies. Region callbacks edit isolated patches and must be synchronous; regions cannot resize the surface. Invalid or failed edits roll back. Existing generic element editing can replace a validated surface buffer when resizing is intentional.

Storage divides bytes into immutable 64 KiB blocks and shares identical blocks. A small pixel edit replaces only affected byte blocks and their metadata references. Undo stores changed byte ranges, not one property edit per byte or a full retained image per operation. The authoring transaction still makes a temporary rollback snapshot, and panel loading/rendering still materializes its surfaces; storage blocks are not a promise of tiled or constant-memory painting. Surfaces and raster-layer bounds share the existing 32-megapixel render budget and fail explicitly above it.

`toJSON()` returns the full in-memory document, including typed buffers; it is not a JSON-string round-trip format for pixel surfaces. Use `.save()`/`.open()` for editable persistence, and bounded pixel-region reads for inspection. The flagship's panel 04 pavement reflection is original code-authored pixel artwork combined with vector contours and brush replay.

## Selections and fill

`polygonPixelSelection(width, height, points, fillRule?)` creates an antialiased coverage mask using Skia. Use sampled curves for organic outlines. The fill rule is `nonzero` by default, with `evenodd` available for self-intersecting outlines. Coordinates are local source pixels; the polygon may extend outside the surface and is clipped at its edge.

`colorPixelSelection(image, x, y, { tolerance: 0, contiguous: true })` selects four-connected matching pixels from a seed. Set `contiguous: false` to select matching pixels anywhere. Tolerance is the maximum permitted difference in each premultiplied sRGB channel and alpha, in byte units (0–255). Thus fully transparent pixels match regardless of hidden RGB. This is a channel-distance selection, not perceptual colour matching, edge inference, or gap closing.

`combinePixelSelections(a, b, operation)` supports `union` (maximum coverage), `intersect` (minimum), and `subtract` (clamped difference). `invertPixelSelection` returns complementary coverage. Inputs remain unchanged. A selection is `{ width, height, coverage: Uint8Array }`, one coverage byte per pixel. Custom masks can use the same structure.

```ts
import { polygonPixelSelection, fillPixels } from 'codeboard-studio';

paint.editPixels(surface, { x: 0, y: 0, width: 240, height: 56 }, patch => {
  const selection = polygonPixelSelection(240, 56, [
    { x: 72, y: 4 }, { x: 129, y: 3 },
    { x: 199, y: 47 }, { x: 102, y: 49 },
  ]);
  fillPixels(patch, [250, 205, 125, 180], { selection, mode: 'source-atop' });
});
```

Fill modifies the supplied buffer. `source-over` paints normally; `source-atop` tints only existing pixels and preserves alpha; `destination-out` erases alpha while retaining hidden source RGB; `copy` replaces pixels, interpolating premultiplied source/destination values at partial mask coverage. Unselected bytes are untouched. Colour values must be explicit RGBA8 bytes. Compositing follows the corresponding [Porter–Duff equations](https://www.w3.org/TR/compositing-1/#porterduffcompositingoperators) in sRGB channel space, with byte rounding; it is not linear-light or material simulation.

Selections are transient operation inputs, not additional persisted project snapshots. Applied edits participate in the usual transaction, undo, binary save and revision handling. The flagship revision uses a polygon selection to warm only part of the raster reflection, verifies unchanged alpha/outside-mask pixels, and proves pixel undo and reopened-byte equality.

Memory is bounded by the same 32-megapixel surface limit. Flood selection allocates a one-byte mask plus a four-byte queue per source pixel (up to 160 MiB in addition to the surface at that limit); polygon masks also need a temporary Skia canvas/readback. These operations are synchronous and materialize the selected source buffer. No streaming, tiled-fill, or constant-memory claim is made.

## Feathered corrections

`await featherPixelSelection(selection, sigma)` returns an independently owned selection with Gaussian-softened coverage. It does not blur artwork RGB or alpha. Sigma is in local source-pixel units: `0` makes an exact independent copy; otherwise the accepted range is `0.3–1000`. Samples at the surface boundary repeat the edge coverage, so a fully selected surface remains fully selected. Coverage outside the surface is not added. Small selections can lose peak coverage as they spread; this is a filtering operation, not a distance-based falloff or selection expansion.

```ts
import { polygonPixelSelection, featherPixelSelection, fillPixels } from 'codeboard-studio';

const selection = await featherPixelSelection(
  polygonPixelSelection(240, 56, [
    { x: 76, y: 3 }, { x: 144, y: 3 },
    { x: 190, y: 53 }, { x: 94, y: 53 },
  ]), 6,
);
// Resolve the asynchronous mask before entering a synchronous artwork transaction.
paint.editPixels(surface, { x: 0, y: 0, width: 240, height: 56 }, patch => {
  fillPixels(patch, [255, 228, 169, 255], { selection, mode: 'source-atop' });
});
```

This uses the installed Sharp/libvips [Gaussian blur](https://sharp.pixelplumbing.com/api-operation/#blur) with float precision and a fixed `minAmplitude: 0.01`, then quantizes the result to coverage bytes. Float precision avoids the constant-coverage drift observed with the native integer default. The input is copied before asynchronous native work, including when callers immediately modify their original mask. The operation materializes the mask and native intermediates; it is not a streaming or constant-memory filter. Existing surface allocation limits apply.
