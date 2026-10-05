# Drawing and painting

[![Textured raster stroke, vector stroke and enlarged pixel surface](../../website/public/art/guides/representations.png)](../../website/public/art/guides/representations.png)

The first two examples share a pen path; the third is a low-resolution pixel image. Each retains a different kind of editable data.

Draw inside a panel using raster or vector layers. You can combine both in the same panel, for example a painted rough, vector clean-up, and raster shading.

The examples below assume a `project` and `panel` created as follows:

```ts
import { StoryboardProject, brushes, catmullRom, pathCommands } from 'codeboard-studio';

const project = StoryboardProject.create({
  title: 'Study', width: 1280, height: 720, frameRate: 24,
});
const panel = project.addScene('Scene').addShot('Study').addPanel();
```

## Paint a curved stroke

```ts
const rough = panel.addRasterLayer('Rough');
const strokeId = rough.rasterStroke(catmullRom([
  { x: 180, y: 520, pressure: .15, time: 0 },
  { x: 380, y: 190, pressure: .9, time: 300 },
  { x: 720, y: 430, pressure: .25, time: 700 },
], 24), brushes.roughPencil, { color: '#272721', seed: 12 });
```

Coordinates are canvas units, with the origin at the top left. X increases rightward and Y downward. Pressure ranges from 0 to 1. Point `time` is pen input time in milliseconds; it affects speed dynamics, not animation timing. Supply increasing timestamps when using speed-sensitive brushes.

`catmullRom` generates smooth samples through your control points. Other helpers include `line`, `cubic`, `ellipse`, `hatchPolygon`, `translate`, `scale`, `mirrored`, and `withPressure`. Use `samplePath` to turn an SVG-style path into pen samples.

## Revise or erase paint

Keep the returned stroke ID so you can edit it later:

```ts
rough.edit(strokeId, stroke => ({ ...stroke, color: '#8b5528' }));
rough.erase([
  { x: 310, y: 260, pressure: 1 },
  { x: 410, y: 260, pressure: 1 },
], { ...brushes.cleanInk, size: 30 });
```

Paint commands replay in order. Editing an earlier stroke can change the result of later erasing or overlapping paint. An eraser affects its own layer.

## Draw an editable contour

<!-- study:stroke-outline:start -->
**Turn a stroke into editable geometry.** When should a stroke become a contour?

[![The first two silhouettes match; the final one has a rectangle cut out.](../../website/public/art/guides/stroke-outline.png)](../../website/public/art/guides/stroke-outline.png)

The first two silhouettes match; the final one has a rectangle cut out. Outlining preserves the shape but replaces stroke-width editing with contour editing.

<!-- study:stroke-outline:end -->

```ts
const ink = panel.addVectorLayer('Ink');
const contourId = ink.path(pathCommands(
  'M 220 480 C 260 220 470 190 620 430 L 580 510 Z'
), { fill: '#242820', stroke: '#131610', strokeWidth: 3 });

ink.edit(contourId, contour => ({
  ...contour,
  commands: pathCommands('M 220 480 C 280 180 490 220 620 430 L 580 510 Z'),
}));
```

Use `vectorStroke(points, options)` for pressure-shaped vector lines. `outlineStroke(id)` converts one to a contour; `booleanPath(id, toolPath, operation)` combines it with another path using `union`, `intersect`, `difference`, or `xor`.

Vector contours retain their geometry. A raster stroke retains its pen samples and brush settings for replay. A pixel surface retains pixels. These representations have different editing operations.

## Gradient fills, text, and contour tools

<!-- study:gradient-fills:start -->
**Shape a fill with color.** How can a flat contour suggest volume?

[![The contour stays fixed while the color becomes directional, then radial.](../../website/public/art/guides/gradient-fills.png)](../../website/public/art/guides/gradient-fills.png)

The contour stays fixed while the color becomes directional, then radial. A gradient changes the fill inside an existing shape.

<!-- study:gradient-fills:end -->

<!-- study:vector-booleans:start -->
**Build a shape from two shapes.** What remains when two shapes overlap?

[![Compare the overlap with union, intersection, difference and exclusive-or.](../../website/public/art/guides/vector-booleans.png)](../../website/public/art/guides/vector-booleans.png)

Compare the overlap with union, intersection, difference and exclusive-or. Boolean operations create new path geometry from the same two inputs.

<!-- study:vector-booleans:end -->

```ts
const fill = {
  kind: 'linear', from: { x: 220, y: 200 }, to: { x: 620, y: 510 },
  stops: [{ offset: 0, color: '#ffc078' }, { offset: 1, color: '#bb5627' }],
};
ink.edit(contourId, element => ({ ...element, fill }));
ink.text('Anticipation', 220, 570, {
  color: '#242820', font: '24px sans-serif', align: 'left',
});
```

Fills can be solid colors, linear gradients, or radial gradients. Radial endpoints also have a `radius`. Stops use offsets from 0 to 1. Text remains a text element and uses fonts available to the renderer; it is not an outlined path.

`pathCommands` parses the absolute SVG-style `M L Q C Z` subset. Relative commands, arcs, and implicit repeated commands are unsupported. `pathBounds` returns a contour's bounds, `pathContains` tests a point against a closed contour, and `splitPathSegment(commands, index, t)` splits a segment at a fraction strictly between 0 and 1. These operate on source geometry; transform frame-space points back to local coordinates first.

`combinePaths(a, b, operation)` returns new contour commands. Boolean operands must be closed contours. Assign the result with `layer.edit`, or use `layer.booleanPath` to replace an existing vector contour directly. Outlining a vector stroke changes its representation to a filled contour; subsequent width edits no longer act like stroke-width changes.

## Work with pixels

```ts
import { createPixels, fillPixels } from 'codeboard-studio';

const pixels = createPixels(120, 80);
fillPixels(pixels, [190, 130, 50, 255]);
const surfaceId = rough.rasterSurface(pixels);
rough.editPixels(surfaceId, { x: 20, y: 10, width: 40, height: 30 }, patch => {
  fillPixels(patch, [30, 35, 29, 255]);
});
```

Pixel data uses RGBA bytes. `readPixels` reads a surface or region. Selection helpers include `polygonPixelSelection`, `colorPixelSelection`, `combinePixelSelections`, `invertPixelSelection`, and `featherPixelSelection`. Pass a selection to `fillPixels` to limit a fill.

Continue with [brushes](brushes.md) and [layers](layers.md).

For image import, color selections, polygon masks, feathering, patch editing and difference measurement, see [pixel surfaces](pixels.md). For every drawing function's parameters and return shape, use the [drawing API](../reference/api/drawing.md).
