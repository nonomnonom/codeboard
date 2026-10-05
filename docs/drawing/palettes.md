# Keep colors consistent with palettes

Bind shared colors to swatches, then change a character or prop across drawings. Use local overrides for deliberate exceptions.

## Share palette colors across artwork

[![Shared coat colors change while the local override stays dark](../../website/public/art/guides/palettes.png)](../../website/public/art/guides/palettes.png)

A bound element follows its swatch; a local override retains its own color.

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

Palette mutation preflight checks every bound channel before installing a replacement palette
or changing any cached color. If a replacement removes a referenced swatch, catching that error
inside a surrounding transaction leaves its palette/color values unchanged. Removing a referenced
palette likewise rejects before changing the collection, including overridden bindings. Unbind
or retarget consumers before removal. This preflight applies to these palette operations; it is
not a generic savepoint for arbitrary nested edits or callback side effects. Final transaction
validation and foreign-lock checks still govern publication.
