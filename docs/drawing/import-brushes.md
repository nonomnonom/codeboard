# Import brush tips and textures

A resource is a tip or texture asset. A preset is a set of settings. The Codeboard brush engine executes those settings. Importing a Photoshop or Krita resource does not install its original engine.

<!-- study:brush-import:start -->
**Use an imported shape as a brush tip.** How does a PNG become a repeating mark?

[![Compare close and wide spacing with the same diamond-shaped tip.](../../website/public/art/guides/brush-import.png)](../../website/public/art/guides/brush-import.png)

Compare close and wide spacing with the same diamond-shaped tip. This study authors a PNG locally, imports its alpha, then uses Codeboard brush settings. It does not emulate a foreign brush engine.

<!-- study:brush-import:end -->

## Inspect before selecting a tip

```ts
import { importBrushResource } from 'codeboard-studio';
const report = await importBrushResource('brushes.bundle', {
  origin: { source: 'My brush collection', license: 'CC0-1.0', redistribution: 'allowed' },
  maxTipSize: 256,
});
console.log(report.resources.map(({ id, name, role, originalWidth, originalHeight }) =>
  ({ id, name, role, originalWidth, originalHeight })));
console.log(report.presets.map(({ name, engine, resourceIds, mapped }) =>
  ({ name, engine, resourceIds, mapped })));
console.log(report.missingDependencies, report.unsupported, report.warnings);
```

Replace the example provenance with the resource's actual source and license. Select by reported role and identity, not by assuming the first resource is a usable tip. The report retains a checksum for the source file and each decoded resource.

## Provide a linked Krita dependency

```ts
import { readFile } from 'node:fs/promises';
const report = await importBrushResource('pencil.kpp', {
  origin: { source: 'My pencil', license: 'CC0-1.0', redistribution: 'allowed' },
  dependencies: { 'brushes/pencil.gbr': await readFile('brushes/pencil.gbr') },
});
```

Dependency names must match the preset resource references. Supply the actual tip bytes, not a screenshot or the KPP preview. A BUNDLE can provide its own embedded dependencies. If a dependency remains unresolved, inspect the reported name and correct the mapping; do not substitute a default brush without deciding to reauthor the preset.

## Reauthor the supported preset settings

```ts
import { brushes, brushFromResource, renderBrushSwatch } from 'codeboard-studio';
import { writeFile } from 'node:fs/promises';
const preset = report.presets[0];
const resource = report.resources.find(r =>
  r.role === 'tip' && (!preset || preset.resourceIds.includes(r.id)));
if (!resource) throw new Error('Selected preset has no resolved brush tip');
const brush = brushFromResource(resource, {
  ...brushes.cleanInk, ...preset?.mapped,
  id: 'brush:imported-pencil', name: 'Imported pencil', size: 36,
});
await writeFile('imported-swatch.png', await renderBrushSwatch(brush));
```

This explicitly chooses Codeboard settings for unmapped behavior. `mapped` currently contains supported spacing, opacity, and flow values when present. It is not a conversion of all foreign dynamics. Inspect both preset-level and report-level unsupported entries.

`brushFromResource` rejects a texture resource as a tip. Use its alpha data in `paperTexture` instead:

```ts
const texture = report.resources.find(r => r.role === 'texture');
if (texture) brush.paperTexture = {
  width: texture.tip.width, height: texture.tip.height,
  alpha: texture.tip.alpha, scale: 1, strength: .4,
};
```

## Formats and limits

| Resource | Implemented behavior | Does not reproduce |
| --- | --- | --- |
| PNG | Alpha, luminance, or inverse-luminance mask | Full-color image stamping |
| GBR | v1/v2 grayscale and RGBA tip extraction | GIMP brush engine behavior |
| GIH | Extract individual GBR cells | Image-pipe cell selection dynamics |
| ABR | Sampled 8-bit tips, v1/v2 and v6.1/v6.2 | Computed tips and Photoshop dynamics |
| KPP | Preset fields and supported resolved dependencies | Krita paint engines or preview-as-tip fallback |
| BUNDLE | Supported brush, pattern, and preset resources | Arbitrary archive content or unknown encodings |

Tip import dimensions are at most 512 pixels per side. Choose `maxTipSize` deliberately and inspect resize warnings. The importer enforces bounded input and bundle expansion limits; a resource outside those limits fails instead of exhausting memory. An unsupported resource may produce a report without a usable tip.

For in-memory files, use `importBrushResourceBuffer(bytes, filename, options)`; the filename supplies the format extension. Saving a project preserves the selected tip, texture, and brush settings with the artwork. Keep original foreign files separately if you need their unconverted settings.

See [brush authoring](brushes.md) for custom tips, derived presets, and version behavior.

## Input ownership and limits

Both brush import entry points validate and capture options/provenance before asynchronous work. Buffer imports copy the source bytes; supplied dependency buffers are copied too. Caller edits to these values after starting an import do not change its decoded resource or recorded origin. Unknown option fields and invalid mask/role/provenance values reject with `INVALID_ARGUMENT`.

The main resource limit is 64 MiB. File imports check the opened file size and read bounded chunks, stopping if the file grows beyond that limit. Supplied dependencies allow at most 4096 entries, 16 MiB per entry and 64 MiB combined, checked before copying bytes. Archive limits remain separate. These are input limits, not a global peak-memory budget for decompression, image decoding or output masks. The importer does not lock source files against external edits while reading.
