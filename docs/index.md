# Codeboard documentation

Codeboard is a JavaScript/TypeScript toolkit for drawing, storyboards and 2D animation. Your agent writes code; the engine produces editable artwork and renders frames, sheets and films.

## Install and draw

Download a [portable package for your OS](install.md), or [build from source](getting-started.md). No model service or account is required to run Codeboard.

Read the [authoring guide](authoring.md) to create a project, draw with brushes, manage layers and render your first panel. The [agent review loop](agent-workflow.md) covers inspecting frames and making targeted revisions.

## Drawing and painting

- [Custom and imported brushes](brush-resources.md): author tips, inspect import reports and preserve brush settings with artwork.
- [Vector geometry](vector-geometry.md): edit contours and convert pressure strokes to outlines.
- [Pixel editing](pixels.md): paint and revise pixel surfaces and selections.
- [Gradient fills](gradient-fills.md): use editable linear and radial vector fills.
- [Transforms](transforms.md): place artwork with local coordinates and pivots.

## Animation and production

- [Frame-by-frame drawings](drawing-sequences.md): holds, blanks, drawing substitutions and onion skins.
- [Animation properties](animation-channels.md): layer and camera keys, easing and timing.
- [Rigging](rigging.md): supported two-bone cutout controls and their limits.
- [Storyboard sheets](storyboard-sheets.md): captions, page layout and PDF export.
- [Inspection](inspection.md): find elements, read bounded metadata and render comparisons.

## Editable projects

The [storage guide](storage.md) explains `.cboard` files, partial reads, transactions, undo and named revisions. Source artwork remains editable; exports are derived outputs.

Codeboard is pre-1.0 software. Read [implemented capabilities and limits](architecture.md) before choosing a workflow. It does not claim complete Harmony or Storyboard Pro parity.

## Examples and source

The repository includes [a small quickstart](../examples/quickstart.mjs), [LENGKAP](../examples/lengkap/README.md) and [THE LAST LIGHT](../examples/README.md). Each example is authored through the public API. Code is MIT; original example artwork and audio use CC0.
