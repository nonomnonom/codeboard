---
name: codeboard-brushes
description: Use when a Codeboard brush mark needs tuning, a custom tip is needed, or PNG, GBR, GIH, ABR, KPP, or BUNDLE brush resources must be imported.
---

# Make the mark reproducible

Prerequisite: codeboard session context.

Read `docs/brushes.md`; for imported files read `docs/brush-resources.md`. Check `docs/api-drawing.md` and `docs/api-types.md` for preset and import shapes.

Start with the desired visible change: edge, taper, buildup, pressure response, directional texture, or paper grain. Compare on one fixed path and seed at the intended stroke size.

## Build or import

For a derived preset, use `customizeBrush` to merge partial dynamics with a complete base preset. A hand-built replacement `dynamics` object must contain the complete required shape; a few pressure fields are not a complete brush. Add the preset through `production.createBrush` for engine validation, then render it. The exported `brushParameterSchema` is JSON Schema data, not a parser with a `.parse()` method.

For an external resource:

1. Inspect reported presets, resource identities and roles, missing dependencies, unsupported fields, and resize warnings.
2. Select the requested preset and its resolved tip. Supply linked dependency bytes under their reported names. Treat a texture as paper texture, not as a stamp tip.
3. Apply supported mapped settings to an explicit Codeboard base. Keep unmapped behavior visible in the report.
4. Render a swatch and a representative artwork stroke; inspect both before applying the brush broadly.

An unresolved KPP tip remains unresolved. Its preview is not a fallback tip. Imported data does not reproduce a foreign paint engine, computed ABR brush, or GIH selection behavior. Preserve actual resource provenance and distribution status.

## Apply the accepted result

Test light/heavy pressure, turns, and overlap only as needed for the requested mark. If speed dynamics matter, supply pen timestamps rather than timeline frames. Keep the accepted preset identity and explicit stroke seed.

Revising a library brush affects future strokes. Feedback about existing paint requires explicit edits to those strokes; do not regenerate the project to propagate a preset change. Deliver the swatch, effective preset, and actual import limitations with the editable artwork.
