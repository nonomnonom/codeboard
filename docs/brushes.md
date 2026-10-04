# Brushes

A brush combines a tip, settings, and optional paper texture. A tip describes the stamped shape; settings control spacing, size, opacity, taper, and dynamics. The Codeboard brush engine paints those stamps along your path.

## Customize a preset

```js
import { brushes, customizeBrush, renderBrushSwatch } from 'codeboard-studio';
import { writeFile } from 'node:fs/promises';

const pencil = customizeBrush(brushes.roughPencil, {
  id: 'brush:soft-pencil', name: 'Soft pencil', size: 18,
  opacity: .65, spacing: .15,
  dynamics: { pressureSize: .8, pressureOpacity: .6 },
});
await writeFile('pencil-swatch.png', await renderBrushSwatch(pencil));
```

Built-in presets are `roughPencil`, `cleanInk`, `shadeBrush`, `charcoal`, and `softEraser`. Customize a copy rather than changing a shared definition.

| Setting | Effect |
| --- | --- |
| `size` | Tip width in canvas units |
| `opacity`, `flow` | Paint transparency and accumulation |
| `hardness` | Tip edge falloff |
| `spacing` | Distance between stamps, relative to brush size |
| `taperStart`, `taperEnd` | Narrow the stroke near its ends |
| `tip.rotationMode` | Fixed, path-following, or stylus orientation |
| `texture`, `textureStrength` | Procedural graphite, charcoal, or dry-brush texture |
| `paperTexture` | A repeating bitmap texture attached to the artwork |
| `dynamics` | Responses to pressure, speed, tilt, and rotation jitter |

Use `brushParameterSchema` to inspect and validate the full preset structure. Set an explicit stroke `seed` when using randomized texture or rotation jitter.

## Import a bitmap tip

```js
import { importBrushResource, brushFromResource } from 'codeboard-studio';

const report = await importBrushResource('my-tip.png', {
  maskMode: 'alpha', maxTipSize: 256,
  origin: {
    source: 'My painted tip', author: 'Me',
    license: 'CC0-1.0', redistribution: 'allowed',
  },
});
console.log(report.missingDependencies, report.unsupported, report.warnings);
if (!report.resources.length) throw new Error('No usable tip in this resource');
const brush = brushFromResource(report.resources[0], {
  ...brushes.cleanInk, id: 'brush:painted-tip', name: 'Painted tip', size: 64,
});
await writeFile('tip-swatch.png', await renderBrushSwatch(brush));
```

Use `alpha` for transparent PNG tips, or `luminance` / `inverse-luminance` to derive a mask from brightness. A bitmap tip uses the stroke's chosen color; it does not paint the original RGB image as a color stamp. `maxTipSize` controls import resolution, with a maximum of 512 pixels; review any resize warning before using the brush.

## External resource support

| Format | What you can use |
| --- | --- |
| PNG | Bitmap alpha or brightness masks |
| GBR | GIMP v1/v2 grayscale and RGBA tips |
| GIH | Individual GBR cells; choose the cell to use |
| ABR | Sampled 8-bit tips from v1/v2 and v6.1/v6.2 |
| KPP | Preset metadata, supported settings, and resolved embedded or linked tips |
| BUNDLE | Supported brushes, patterns, and presets inside a Krita resource bundle |

Read the import report before painting. Foreign engine behavior is not reproduced automatically. GIH cell-selection behavior, computed ABR tips, and many Photoshop/Krita dynamics are unsupported. A KPP preview image is not used as a brush tip. Missing dependencies remain reported rather than being replaced with a round brush.

Record the actual source and license of resources you import. Only set `redistribution: 'allowed'` when you have permission to distribute the resource.

## Save and reuse a brush

```js
const brushId = project.production.createBrush(brush);
const savedBrush = project.production.brush(brushId);
panel.addRasterLayer('Paint').rasterStroke(points, savedBrush);
project.production.reviseBrush(brushId, { size: 90 });
```

Saving the project stores its brush definitions and tip data. Revising a library brush affects future strokes; existing strokes keep their recorded brush settings. Use an explicit stroke edit when you want older paint to use a different brush.
