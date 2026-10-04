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

Public guides live in `docs/` and feed the Fumadocs site directly. After changing public signatures, run `node scripts/build-api-docs.mjs` to refresh the six API reference pages, then review the related task guides. The generator reads public exports and callable members; it excludes private and underscore-prefixed implementation methods.

To regenerate the demo's documentation images, editable example, and source ZIP, build the engine and run `node scripts/build-doc-assets.mjs`. The original 48-second presentation video is curated separately; its public copy contains no audio. Test the downloaded example with `npx vitest run test/documentation-example.test.ts` and build the website with `npm run build --prefix website`.

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

The engine lives in `src/`: `core` owns authoring operations, `drawing` brush and geometry tools, `animation` timing, `render` images, `storage` project persistence, and `export` deliverables. `website/` builds the public site from `docs/`. Keep development notes out of the public guides. Follow surrounding code style; avoid unrelated reformatting. AI-assisted contributions receive the same review: the contributor must understand and verify the change.

## Releases

Use semantic versioning. Update the root package and lockfile versions, add a dated changelog entry, and merge through a passing pull request. Tag the merged commit as `vVERSION`; the Release workflow verifies, builds and smoke-tests each portable package, then publishes the archives, installers and checksums to GitHub Releases. No npm publishing is configured.

There is no CLA. Contributions are accepted under the repository's MIT license; do not submit work you cannot license that way. Report security issues through [SECURITY.md](SECURITY.md), and follow the [Code of Conduct](CODE_OF_CONDUCT.md).
