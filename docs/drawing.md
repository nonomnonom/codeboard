# Drawing and painting

Draw inside a panel using raster or vector layers. You can combine both in the same panel, for example a painted rough, vector clean-up, and raster shading.

The examples below assume a `project` and `panel` created as follows:

```js
import { StoryboardProject, brushes, catmullRom, pathCommands } from 'codeboard-studio';

const project = StoryboardProject.create({
  title: 'Study', width: 1280, height: 720, frameRate: 24,
});
const panel = project.addScene('Scene').addShot('Study').addPanel();
```

## Paint a curved stroke

```js
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

```js
rough.edit(strokeId, stroke => ({ ...stroke, color: '#8b5528' }));
rough.erase([
  { x: 310, y: 260, pressure: 1 },
  { x: 410, y: 260, pressure: 1 },
], { ...brushes.cleanInk, size: 30 });
```

Paint commands replay in order. Editing an earlier stroke can change the result of later erasing or overlapping paint. An eraser affects its own layer.

## Draw an editable contour

```js
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

## Work with pixels

```js
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
