# Drawing and painting

![Textured raster stroke, vector stroke and enlarged pixel surface](https://codeboard.nonom.xyz/art/guides/representations.png)

The first two examples share a pen path; the third is a low-resolution pixel image. Each retains a different kind of editable data. [Run the visual studies](visual-examples.md).

Draw inside a panel using raster or vector layers. You can combine both in the same panel, for example a painted rough, vector clean-up, and raster shading.

The examples below assume a `project` and `panel` created as follows:

```ts
import { StoryboardProject, brushes, catmullRom, pathCommands } from 'codeboard-studio';

const project = StoryboardProject.create({
  title: 'Study', width: 1280, height: 720, frameRate: 24,
});
const panel = project.addScene('Scene').addShot('Study').addPanel();
```

## Share palette colors across artwork

![Shared coat colors change while the local override stays dark](https://codeboard.nonom.xyz/art/guides/palettes.png)

The [palette study](visual-examples.md#update-shared-palette-colors) generates this before/after image from persisted bindings.

Keep shared solid colors in a project palette and bind an element's color channel to a stable swatch ID. Palette and swatch IDs share the document's global ID namespace. `putPalette` replaces one palette and updates its bound colors in the same transaction, including board panels, component sources and shot animations.

```ts
const paint = panel.addVectorLayer('Paint');
const shirtId = paint.path(pathCommands('M100 100 L200 100 L200 200 L100 200 Z'), {
  fill: '#456789',
});
project.putPalette({
  id: 'palette:character', name: 'Character',
  swatches: [{ id: 'swatch:shirt', name: 'Shirt', color: '#456789' }],
});
project.setColorBinding(shirtId, 'fill', { swatchId: 'swatch:shirt' });

// An explicit local correction survives later swatch changes.
project.setColorBinding(shirtId, 'fill', {
  swatchId: 'swatch:shirt', override: '#28415c',
});
// Remove the override to follow the shared swatch again.
project.setColorBinding(shirtId, 'fill', { swatchId: 'swatch:shirt' });
// Detach the binding and keep the current literal color.
project.setColorBinding(shirtId, 'fill', null);
```

Supported channels are `color` for text and raster strokes, `color`/`fill` for vector strokes, and `fill`/`stroke` for vector paths. Binding a path fill explicitly replaces any gradient with the swatch's solid color. Pixel surfaces and individual gradient stops cannot be bound. These values use the existing drawing color pipeline; palettes do not add color-space conversion or external asset publishing.

Bindings belong to the artwork. Panel duplication, panel-to-shot capture and component cloning retain them; outlining a vector stroke maps its `color` binding to the resulting path's `fill`. Replacing an element is an explicit complete replacement: retain its `colorBindings` when the new artwork should keep following the palette. A bound literal must match its swatch or override; inconsistent edits reject. Removing a referenced swatch or palette rejects, including overridden references. Unbind or retarget those elements first. Any propagated edit touching another actor's locked artwork rolls back the whole transaction.

Use `palettes({ limit, offset })` for summaries, `paletteSwatches(id, { limit, offset })` for detached swatches, and `production.element(id).colorBindings` to inspect an element. Paged reads enforce the standard 200-record and 256 KiB limits. Each palette holds at most 1,000 swatches and 1 MiB of JSON. `production.query` and the saved object catalog expose `palette` and `palette-swatch` kinds.

Before revising a swatch, call `project.paletteBindings(swatchId, { limit, offset })` to inspect its consumers without reading artwork payloads. Each record contains `ownerKind` (`panel`, `component` or `animation`), `ownerId`, `layerId`, `elementId`, `channel`, `swatchId`, and an optional local `override`. An override remains listed because it is still bound even when the effective color is unchanged by a swatch update. Missing swatches reject; an unused swatch returns an empty array. Reads default to 50 entries, cap at 200 and reject responses above 256 KiB. Ordering follows panels, components, then shot animations, with layer/element order and color/fill/stroke channel order inside each owner. Restart offset paging after edits; these pages do not have snapshot cursors.

Saved revision workflows use native `palette.put`, `palette.bind` (a binding or `null`), and `palette.remove` commands in `project.plan`/`commit`. Propagated literal colors persist with the bindings, so standalone shot snapshots render without a separate palette resolver. Save/reopen, checkpoints and undo retain both. Builds predating palette support reject the added strict studio field; use a compatible runtime to reopen these projects.

Use `mergePalette(base, local, incoming, options?)` for shared-identity palette revision. A null
snapshot means absence; all present snapshots must have the same palette ID and unique swatch
IDs. Different fields or swatches merge independently when collection IDs/order agree. Conflicting
values and competing collection changes require JSON Pointer choices in `resolutions`. Names and
positions never establish identity. Unknown resolution paths reject. `conflictsResolved` distinguishes
a resolved palette removal (`palette: null`) from an unresolved conflict (also no palette).

`planPaletteMerge(project, base, incoming, options?)` reads the local palette and prepares the
existing `palette.put`/`palette.remove` command against the current project version/hash. A null
plan means unresolved conflicts or no change; inspect the report. Final plan validation checks
global IDs, referenced swatches and locks. Propagated colors and local overrides use the existing
palette mutation owner. Removing a still-used swatch remains invalid even after choosing a merge
resolution. The returned palette is a caller-owned authoring payload, not a bounded query page;
palette and report size limits remain 1 MiB and 256 KiB respectively.

The palette study prepares independent local cloth/incoming trim revisions, a durable merge plan,
reopen and a comparison retaining the local override.

Palette mutation preflight checks every bound channel before installing a replacement palette
or changing any cached color. If a replacement removes a referenced swatch, catching that error
inside a surrounding transaction leaves its palette/color values unchanged. Removing a referenced
palette likewise rejects before changing the collection, including overridden bindings. Unbind
or retarget consumers before removal. This preflight applies to these palette operations; it is
not a generic savepoint for arbitrary nested edits or callback side effects. Final transaction
validation and foreign-lock checks still govern publication.

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

For image import, color selections, polygon masks, feathering, patch editing and difference measurement, see [pixel surfaces](pixels.md). For every drawing function's parameters and return shape, use the [drawing API](api-drawing.md).
