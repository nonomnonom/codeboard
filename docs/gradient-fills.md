# Editable vector gradient fills

Vector paths accept a CSS color or a `VectorFill` definition. Linear fills use two points; radial fills use two circles. Coordinates are in the path's local source space, before its element matrix, layer transforms and camera. This follows the native [Skia Canvas gradient API](https://skia-canvas.org/api). Native scalar precision and color interpolation apply.

```ts
const id = ink.path(outline, {fill: {
  kind: 'linear',
  from: {x: -19, y: 0}, to: {x: 19, y: 0},
  stops: [
    {offset: 0, color: '#a67832'},
    {offset: .35, color: '#ffe1a1'},
    {offset: 1, color: '#b77f35'},
  ],
}});
// Radial alternative:
ink.edit(id, element => {
  if (element.kind !== 'vector-path') throw new Error('Expected contour');
  return {...element, fill: {
    kind: 'radial',
    from: {x: -5, y: 10, radius: 0},
    to: {x: -5, y: 10, radius: 55},
    stops: [{offset: 0, color: '#ffe1a1'}, {offset: 1, color: '#a67832'}],
  }};
});
```

At least two stops are required, ordered by offset from 0 through 1. Equal offsets allow sharp color boundaries. Coordinates must be finite within the renderer's scalar range; radii must be nonnegative. Identical linear endpoints or identical radial circles are rejected. A stop need not sit exactly at 0 or 1. Supported CSS colors include alpha; normal element opacity, clipping, masks and layer blending still apply. Invalid definitions fail before artwork mutation. Input definitions, imported documents and edits retain independent owned values.

The geometry and fill settings remain separate editable data. Save/open, partial panel reads and undo retain the definition; no bitmap substitutes for the contour. Cached preview and ordinary rendering use the same fill code. These are static vector-path fills: gradient strokes, raster flood-fill gradients, repeat/reflect spread, mesh gradients and gradient-parameter keyframes are not implemented. Layer animation can move the filled drawing, but does not animate its stops.

Tests check numeric black-to-white pixel values, local placement, an element matrix through a translated half-opacity mask, cached parity, input ownership, invalid-edit isolation, undo, and exact rendering after binary save/open and partial loading.

A subsequent real H.264 export test encodes a twelve-frame linear-gradient drawing while layer opacity changes from 1 to 0.2. It decodes frames 0 and 11 to RGBA and compares four interior grayscale samples in each against `renderFramePNG`, allowing at most 8 channel levels for lossy video/color conversion. The late dark-side sample must brighten by more than 150 levels, checking that animated opacity is actually exported. All eight movie/gradient tests and typecheck passed in that follow-up. This fixture verifies export behavior at those samples; it is not a bound for all colors, codecs or frames, and it does not animate gradient stop parameters.
