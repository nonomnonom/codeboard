# Examples

Examples call the public API. Generated outputs go under ignored `examples/output/`. Authoring commands regenerate their own outputs; keep independently edited projects elsewhere.

## First stroke

```sh
npm run build
npm run example:quickstart
```

[Source](quickstart.mjs). Creates a small editable two-second animation and a PNG without FFmpeg. This is the recommended first run.

## LENGKAP

A fictional 15-second satire in six scenes, using broad ink, sparse forms, and editable detail strokes. No dialogue or generated video.

```sh
npm run example:lengkap
npm run example:lengkap:movie
npm run example:lengkap:verify
```

[Source](lengkap.ts) · [Production notes](lengkap/README.md) · [Curated movie](../docs/media/lengkap.mp4). Movie export requires FFmpeg. Verification checks timing, material use, per-scene detail layers, save/open integrity, and an isolated revision.

## THE LAST LIGHT

A 14-panel storyboard and revised 30.5-second animatic. The base project is 30 seconds; its directed revision extends it by half a second.

```sh
npm run example
npm run example:revise -- --movie
```

Original artwork and synthesized audio are CC0-1.0; source code is MIT. Fonts and imported third-party resources are not relicensed by these examples.
