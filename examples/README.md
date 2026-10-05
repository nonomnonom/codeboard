# Examples

Install [Codeboard from npm](../docs/install.md) with `npm install -g codeboard-studio@0.2.1` first; these examples target release **0.2.1**. Run the commands from a downloaded or cloned repository, without an additional project dependency install or an engine build. Only movie export needs FFmpeg. Examples call the public API. Generated outputs go under ignored `examples/output/`. Authoring commands regenerate their own outputs; keep independently edited projects elsewhere.

## First stroke

```sh
codeboard run examples/quickstart.mjs
```

[Source](quickstart.mjs). Creates a small editable two-second animation and a PNG without FFmpeg. This is the recommended first run.

## LENGKAP

A fictional 15-second satire in six scenes, using broad ink, sparse forms, and editable detail strokes. No dialogue or generated video.

```sh
codeboard run examples/lengkap.ts
codeboard run examples/lengkap.ts --movie
codeboard run examples/lengkap/verify.ts
```

[Source](lengkap.ts) · [Production notes](lengkap/README.md) · [Curated movie](../docs/media/lengkap.mp4). Movie export requires FFmpeg. Verification checks timing, material use, per-scene detail layers, save/open integrity, and an isolated revision.

## THE LAST LIGHT

A 14-panel storyboard and revised 30.5-second animatic. The base project is 30 seconds; its directed revision extends it by half a second.

```sh
codeboard run examples/last-light.ts
codeboard run examples/revise-last-light.ts --movie
```

Original artwork and synthesized audio are CC0-1.0; source code is MIT. Fonts and imported third-party resources are not relicensed by these examples.

## Codeboard launch demo

The [48-second demo](../code-board-demo/README.md) includes its drawing source, original synthesized Foley, turnaround, frame comparisons, and editable output.

```sh
codeboard run code-board-demo/src/run.ts author
codeboard run code-board-demo/src/run.ts render
```
