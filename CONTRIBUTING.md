# Contributing to Codeboard

Codeboard is a code-authored drawing and animation toolkit. Changes should improve its public authoring API, editable storage, rendering, or evidence that those features work.

## Start locally

Use Node.js 22.22 or later and npm. Clone your fork, then run:

```sh
npm ci
npm run check
```

Set `SKIA_CANVAS_THREADS=2` on machines with limited memory. Movie tests run when `FFMPEG_PATH` points to FFmpeg. For example, `FFMPEG_PATH=ffmpeg npm test` on macOS/Linux, or `$env:FFMPEG_PATH='ffmpeg'; npm test` in PowerShell. CI runs these integration tests on Linux.

## Make a focused change

Public guides live in `docs/` and feed the Fumadocs site directly. Edit those guides once. The six `docs/api-*.md` reference pages are generated from public exports and callable members; edit their owning source declarations or generator introductions instead. After changing documentation, public signatures, bundled examples, or the engine version, run `npm run docs:generate`. It refreshes the API pages and the plugin's offline reference bundle. Never hand-edit `plugin/skills/codeboard/references/engine/`. CI and release validation reject stale API pages and stale bundled files through `npm run check`. See the [documentation ownership review](plugin/docs/design.md#documentation-distribution-review) for the complete source-to-delivery path.

Install the published CLI with `npm install -g codeboard-studio` before running user examples; `npm run example:quickstart` invokes that installation. Examples must also run from a folder outside this checkout, without its dependencies. To regenerate the demo documentation images and editable example, run `codeboard run scripts/build-doc-assets.mjs`. Then run `node scripts/package-examples.mjs` to package source downloads. Run `npm run docs:assets` to regenerate the focused guide illustrations and downloadable source from `examples/documentation.mjs`, including the exact starter output. Staging projects stay in `.preview/documentation-assets`; published illustrations live in `website/public/art/guides`. Inspect fresh images after changing their source. The complete presentation is authored with `codeboard run code-board-demo/src/run.ts render`; its soundtrack is original synthesized Foley. Test the downloaded example with `npx vitest run test/documentation-example.test.ts` and build the website with `npm run build --prefix website`.

1. For an API redesign, storage change, or substantial new feature, open an issue describing a concrete authoring task first.
2. Implement behavior in its owning module. Keep example-specific composition in `examples/`; engine code must work for other artwork too.
3. Add a regression test for a bug or invariant. For rendering changes, also inspect actual images or playback. Compilation alone cannot establish visual quality.
4. Update the relevant documentation. For a change that needs a package release, run `npm run changeset` and commit its release type and summary; Changesets generates `CHANGELOG.md` during release preparation.
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

npm is the runtime distribution channel. The root package includes both the public library and the CLI; Node.js is supplied by the user. Do not build platform archives or publish installer scripts.

Use [Changesets](https://changesets.dev/guide/getting-started) to manage versions and changelog entries for the single `codeboard-studio` package. Contributors run `npm run changeset` and commit the generated `.changeset/*.md` file with their change. Select patch for compatible fixes, minor for features, and the appropriate breaking release for API or CLI incompatibilities. Tooling-only changes do not need to trigger an npm release.

When ready to release, run `npm run version-packages`. This consumes pending changesets, generates the changelog, refreshes the npm lockfile, synchronizes all plugin manifests and website version metadata, and rebuilds the offline reference bundle. Review the generated diff, run `npm run check` and `npm run test:install`, and merge through a passing pull request. Do not bump package versions manually or run `changeset publish`; publication belongs to the validated tarball workflow. Never reuse a published version. Tag the merged commit as `vVERSION`; `.github/workflows/release.yml` validates the version, runs the full checks, and tests fresh npm installations on Windows, Linux, and macOS before publishing the validated tarball. Stable versions use the `latest` dist-tag; prereleases use `next`. Manual workflow runs validate without publishing.

Configure an [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/) for `codeboard-studio`: GitHub owner `nonomnonom`, repository `codeboard`, workflow `release.yml`, with publishing allowed. The publish job uses OIDC (`id-token: write`) and npm 11; no long-lived npm token is needed. This npm account setting must be configured before tagging a release. The workflow does not upload runtime assets to GitHub Releases.

For an authenticated manual release, run `npm ci`, `npm run check`, and `npm run test:install`, then `npm pack --ignore-scripts` and `npm publish ./codeboard-studio-VERSION.tgz --access public` (add `--tag next` for a prerelease). Do not publish both manually and through a tag for the same version.

There is no CLA. Contributions are accepted under the repository's MIT license; do not submit work you cannot license that way. Report security issues through [SECURITY.md](SECURITY.md), and follow the [Code of Conduct](CODE_OF_CONDUCT.md).
