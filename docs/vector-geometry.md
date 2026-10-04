# Editable contour operations

## Add a control knot without flattening the curve

`splitPathSegment(commands, index, t = .5)` replaces one L, Q or C command with two commands of the same kind. It uses de Casteljau subdivision in JavaScript Float64 coordinates. `t` is the curve parameter strictly between zero and one, not a fraction of arc length. The preceding endpoint, including the current point after Z, determines the segment start. M and Z cannot themselves be split. Input is validated against the renderer's supported command order and scalar coordinate range; returned commands are detached copies.

```ts
import {splitPathSegment} from 'codeboard-studio';
ink.edit(contourId, element => {
  if (element.kind !== 'vector-path') throw new Error('Expected contour');
  return {...element, commands: splitPathSegment(element.commands, 1, .4)};
});
```

The element retains its identity and style through normal editing, undo and binary persistence. Command indices are positions, not stable IDs; inspect the current commands again after insertion. Each half can then be edited independently through `LayerHandle.edit`. Subdivision preserves the mathematical curve within floating-point arithmetic, but the renderer's tessellation/antialiasing can change at the new boundary, so PNG equality is not promised. It does not enforce tangent continuity after a later control-point edit, perform smoothing or provide automatic inbetweening.

`samplePath(commands, {step: 2, maxSamples: 1_000_000})` converts M/L/Q/C/Z geometry into separate `Point[]` pen paths for vector strokes or custom bitmap painting. Each move starts a new path; closing a contour returns to its authored first point. Move-only contours produce no stroke. Samples receive an 8 ms input cadence per contour; use `withPressure()` or map the returned points to author pressure, time, tilt and rotation. Brush dab spacing remains a separate brush setting.

`hatchPolygon(polygon, {angle, spacing, pressure, jitter, seed, maxSamples})` generates separate clipped pen strokes using even-odd polygon intersections. Angles are radians, spacing and jitter use local drawing units, pressure is 0–1. The default `maxSamples` is 1,000,000; it limits scan rows as well as the total returned pen samples. Exceeding it throws instead of silently changing spacing or truncating the artwork. Increase it explicitly for larger workloads. Coordinates and options must be finite; spacing below the numerical precision of far-away coordinates is rejected with an instruction to translate the polygon nearer the origin. Rows are indexed from the first scanline so floating-point addition cannot stall the loop. This is straight-line polygon hatching, not contour-following shading or a curve-offset algorithm. Runtime also depends on polygon vertex count; the sample budget is not a general execution timeout.

```ts
import {samplePath, pathCommands, withPressure} from 'codeboard-studio';

const geometry = pathCommands('M 20 90 C 40 10 180 10 220 90 M 260 90 Q 290 30 330 90');
for (const points of samplePath(geometry, {step: 1})) {
  paint.rasterStroke(withPressure(points, t => .15 + .85 * Math.sin(Math.PI*t)), customBrush);
}
```

Sampling uses the installed Skia [Path2D.points](https://skia-canvas.org/api/path2d#points) geometry API, marked experimental upstream. Curve length and interior coordinates use its scalar approximation; authored endpoints are preserved. `step` controls local spacing, not an analytic curve-error tolerance. Original contour commands remain untouched. Painting the returned samples creates independent replayable strokes, not a live constraint to the source vector path: explicitly resample after a source-path revision when that relationship is desired. The allocation guard uses a conservative control-polygon length estimate across all subpaths, so it can reject a curve whose actual sample count would be smaller. It fails before native sampling, never silently increases spacing; callers can explicitly raise `maxSamples`.

`combinePaths(a, b, operation)` accepts closed absolute M/L/Q/C/Z command arrays and returns another editable command array. Operations are `union`, `intersect`, `difference` (A minus B), and `xor`. Inputs remain unchanged. Both operands use nonzero winding; output orientation preserves holes with the renderer's same nonzero fill rule. Open contours are rejected rather than silently closed.

```ts
import { pathCommands, combinePaths, pathBounds, pathContains } from 'codeboard-studio';

const cutter = pathCommands('M 80 20 L 120 20 L 120 80 L 80 80 Z');
layer.booleanPath(contourId, cutter, 'difference');
// The contour keeps its ID, name, fill/stroke style and opacity.
// Coordinates of the cutter are local to the element's source geometry.

const silhouette = combinePaths(bodyCommands, sleeveCommands, 'union');
console.log(pathBounds(silhouette));
console.log(pathContains(silhouette, 45, 60));
```

`LayerHandle.booleanPath` edits one vector-path element through the normal transaction, lock, undo and persistence mechanisms. The tool operand is geometry, not a second document object that is implicitly removed. A fully erased shape becomes an empty command array while retaining its stable object identity. It can be edited or undone later; use selection removal when deletion is intended. Bounds are `null` for an empty command array. Hit tests inspect filled closed contours in local coordinates and include their boundary; they do not include stroke width or layer/camera transforms.

Operations affect the filled contour region, not the painted width of an open line. An existing outline stroke will follow the newly computed boundaries, including cut edges. This is not vector-stroke eraser splitting, mesh deformation, automatic cleanup or Boolean operations across transformed layers.

The implementation uses the installed Skia Canvas [Path2D operations and edge inspection](https://skia-canvas.org/api/path2d). That API is marked experimental upstream. Returned Bézier edges are retained as geometry, never rasterized or sampled into a polygon as a hidden fallback. Unsupported native edge types or non-finite coordinates fail without changing the document. The operation explicitly recomputes geometry using Skia's scalar precision; it does not promise exact analytic arithmetic or preservation of the original control-point arrangement. Saved result coordinates remain lossless Float64. Untouched source geometry is unchanged.

Tests cover overlap, subtraction holes, XOR, complete erasure, retained cubic segments, invalid/open operands, stable identity, unaffected panels, undo/redo and save/open render equality. The flagship authors a damaged folded wing with `booleanPath` through the same public API.

## Convert pressure strokes for contour correction

`layer.outlineStroke(elementId)` explicitly converts an unfilled `vector-stroke` into a filled `vector-path`, preserving its stable ID, name, visibility, opacity and element matrix. The outline uses the renderer's shared pressure/width/taper geometry. The renderer itself still traces its existing native arcs; conversion serializes Skia's SVG geometry, representing those arcs as editable quadratic curves. This is an explicit representation change using native scalar precision and curve approximation, not a lossless conversion of pressure samples or an automatic centerline eraser.

```ts
project.transaction('Correct the ink contour', () => {
  ink.outlineStroke(strokeId);
  ink.booleanPath(strokeId, pathCommands(
    'M 280 0 L 337 0 L 337 180 L 280 180 Z'
  ), 'difference');
});
```

The cutter is in the element's local coordinates, before its retained matrix and layer/camera transforms. Existing contour operations can cut, intersect or unite the resulting shape. Full erasure leaves an empty contour with the same ID. Undo of the transaction restores the original stroke samples and settings; after conversion, changing pressure or width is no longer the editing model. A closed stroke with an explicit interior fill is rejected because one filled contour cannot preserve independent fill/stroke colors and their overlapping alpha. Separate that fill before converting. Non-stroke elements also fail without mutation.

Tests cover pressure variation, opacity, a translated element, partial erasure, a round single-point mark, caught invalid conversions, stable identity, transactional undo and binary save/reopen. On the test curve, summed alpha difference between the original stroke and uncut converted contour is below 1% of source alpha; this is a fixture-specific check, not a general error bound. The native [Path2D SVG serialization](https://skia-canvas.org/api/path2d#d) is marked experimental upstream. No new raster fallback is introduced.

### Stationary vector pen samples

Consecutive samples within `1e-6` drawing units of the retained position now form one rendering knot with the highest pressure in that run. Omitted pressure means full pressure. A stroke containing only such samples renders a round mark, using the same midpoint taper evaluation as a single-point stroke; it no longer disappears. Within a moving stroke, a pressure increase while stationary contributes to that knot's width. This is a static vector envelope, not paint accumulation over elapsed input time. Distinct knots retain the existing taper progression. The original sample array, pressure values and timestamps stay unchanged in the editable document; coalescing is only shared render/outline geometry.
