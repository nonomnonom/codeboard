# Contributing to Codeboard

Codeboard is a code-authored drawing and animation toolkit. Changes should improve its public authoring API, editable storage, rendering, or evidence that those features work.

## Start locally

Use Node.js 22.22 or later and npm. Clone your fork, then run:

```sh
npm ci
npm run check
npm run example:quickstart
```

Set `SKIA_CANVAS_THREADS=2` on machines with limited memory. Movie tests run when `FFMPEG_PATH` points to FFmpeg. For example, `FFMPEG_PATH=ffmpeg npm test` on macOS/Linux, or `$env:FFMPEG_PATH='ffmpeg'; npm test` in PowerShell. CI runs these integration tests on Linux.

## Make a focused change

1. For an API redesign, storage change, or substantial new feature, open an issue describing a concrete authoring task first.
2. Implement behavior in its owning module. Keep example-specific composition in `examples/`; engine code must work for other artwork too.
3. Add a regression test for a bug or invariant. For rendering changes, also inspect actual images or playback. Compilation alone cannot establish visual quality.
4. Update the relevant documentation and add a concise entry under Unreleased in `CHANGELOG.md`.
5. Run `npm run check`. Run `npm run test:install` when changing packaging or dependencies; this downloads dependencies into a disposable directory.
6. Open a pull request describing the trigger, resulting behavior, and checks performed. Attach a small rendered sample for visual changes.

Prefer small reproducible examples over large project dumps. Do not commit `dist/`, `node_modules/`, generated projects, local paths, private data, or downloaded third-party brushes. Curated showcase assets live in `docs/media/`; keep licensing and source attribution with them.

## Invariants reviewers will check

- Save/open preserves editable artwork and rendered results; existing projects remain readable or have an explicit migration.
- Stroke seeds and completed write-on textures remain stable across frames and backward seeks.
- Timeline frames, exposures, keyframes, audio and retiming stay consistent.
- Partial storage operations do not overwrite unrelated artwork or bypass optimistic concurrency.
- Imported resources retain provenance and report unsupported behavior rather than silently substituting assets.

The source map is in [the contributor architecture guide](docs/contributor-architecture.md). Follow surrounding code style; avoid unrelated reformatting. AI-assisted contributions receive the same review: the contributor must understand and verify the change.

There is no CLA. Contributions are accepted under the repository's MIT license; do not submit work you cannot license that way. Report security issues through [SECURITY.md](SECURITY.md), and follow the [Code of Conduct](CODE_OF_CONDUCT.md).
