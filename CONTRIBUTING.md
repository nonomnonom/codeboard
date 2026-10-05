# Contributing to Codeboard

Codeboard is a code-authored drawing and animation toolkit. Changes should improve its public authoring API, editable storage, rendering, or evidence that those features work.

## Start locally

Use Node.js 22.22 or later and npm. Clone your fork, then run:

```sh
npm ci
npm run check
```

Set `SKIA_CANVAS_THREADS=2` on machines with limited memory. Media tests require both FFmpeg and ffprobe. In PowerShell, set `$env:FFMPEG_PATH='ffmpeg'` and `$env:FFPROBE_PATH='ffprobe'`, then run `npm run test:media`. npm is the only runtime distribution channel. CI validates the npm package on a single Ubuntu runner. This is a build environment, not an OS restriction or a guarantee of feature availability on every system.

## Test and code quality tools

See [the testing map and contribution rules](test/README.md) for domain ownership, focused commands, fixture policy and the limits of coverage and mutation reports.

`npm test` runs the Vitest unit, integration, and end-to-end projects. Use `npm test -- test/integration/authoring/project.test.ts` for one suite or `npm test -- -t "save"` to filter test names. Tests run in isolated native Node fork processes. Media verification is explicit through `npm run test:media` and requires FFmpeg and ffprobe.

`npm run lint` uses Biome's recommended lint preset; `npm run lint:fix` applies safe fixes. `npm run format:check` checks formatting and `npm run format` writes it. The root configuration covers engine, tests, scripts, examples, plugin tooling, and website source. Generated bundles, downloads, lockfiles, and ignored build outputs are excluded. Non-null assertions remain allowed for bounded geometry/index operations; TypeScript still checks indexed access. Lint warnings and errors fail CI.

`npm run check` runs the build/typecheck, Biome lint and formatting, architecture checks, workspace checks, Vitest, and documentation/plugin checks. `npm run test:install` additionally checks installation of the packed runtime.

## Make a focused change

Public guides live in `docs/` and feed the Fumadocs site directly. Edit those guides once. The API signature pages and grouped type references under `docs/reference/api/` are generated from public exports and callable members; edit their owning source declarations or generator introductions instead. After changing documentation, public signatures, bundled examples, or the engine version, run `npm run docs:generate`. It refreshes the API pages. Run `npm run plugin:build` to generate the installable plugin and offline references in `release/codeboard-plugin/`. Never hand-edit the generated distribution. CI and release validation reject stale API pages and stale bundled files through `npm run check`. See the [documentation ownership review](contributing/documentation.md) for the complete source-to-delivery path.

Build this checkout before running its examples; `npm run example:quickstart` runs in the linked examples workspace, so runtime and declarations match. Type-check the presentation with `npm run demo:typecheck`. Examples must also run from a folder outside this checkout, without its dependencies. To regenerate the demo documentation images and editable example, run `codeboard run scripts/build-doc-assets.ts`. Then run `node scripts/package-examples.mjs` to package source downloads. Run `npm run docs:assets` to regenerate the focused guide illustrations and downloadable source from `examples/studies/src/cli/run.ts`, including the exact starter output. Staging projects stay in `.preview/documentation-assets`; published illustrations live in `website/public/art/guides`. Inspect fresh images after changing their source. The complete presentation is authored with `codeboard run examples/code-board-demo/src/cli/presentation.ts author`; `render` only exports saved state; its soundtrack is original synthesized Foley. Test the downloaded example with `npm test -- test/e2e/documentation-example.test.ts` and build the website with `npm run website:build`.

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

Production operations live in `src/core/production/`; keep `production.ts` as the explicit public facade. Project reads/configuration and edit-plan contracts/execution have separate owners. Command schemas belong to their domain under `src/core/edit-plan/schema/`; keep the parent composer responsible for plan envelopes and preserve command discovery order. See [implementation ownership](contributing/architecture.md) for boundaries and remaining refactors. `npm run typecheck` checks TypeScript without emitting files and `npm run lint` runs Biome; neither replaces architecture or runtime/release checks.

## Releases

npm is the runtime distribution channel. The root package includes both the public library and the CLI; Node.js is supplied by the user. Do not build platform archives or publish installer scripts.

Use [Changesets](https://changesets.dev/guide/getting-started) to manage versions and changelog entries for the single `codeboard-studio` package. Contributors run `npm run changeset` and commit the generated `.changeset/*.md` file with their change. Select patch for compatible fixes, minor for features, and the appropriate breaking release for API or CLI incompatibilities. Tooling-only changes do not need to trigger an npm release.

When ready to release, run `npm run version-packages`. This consumes pending changesets, generates the changelog, refreshes the npm lockfile, synchronizes all plugin manifests and website version metadata, and regenerates API references. Run `npm run plugin:build` to rebuild the installable offline plugin. Review the generated diff, run `npm run check` and `npm run test:install`, and merge through a passing pull request. Do not bump package versions manually or run `changeset publish`; publication belongs to the validated tarball workflow. Never reuse a published version. Tag the merged commit as `vVERSION`; `.github/workflows/release.yml` validates the version, runs the full checks, and tests a fresh installation of the same npm tarball before publishing it. Stable versions use the `latest` dist-tag; prereleases use `next`. Manual workflow runs validate without publishing.

Configure an [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/) for `codeboard-studio`: GitHub owner `nonomnonom`, repository `codeboard`, workflow `release.yml`, with publishing allowed. The publish job uses OIDC (`id-token: write`) and npm 11; no long-lived npm token is needed. This npm account setting must be configured before tagging a release. The workflow does not upload runtime assets to GitHub Releases.

There is no CLA. Contributions are accepted under the repository's MIT license; do not submit work you cannot license that way. Report security issues through [SECURITY.md](SECURITY.md), and follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Local workspaces

The root `codeboard-studio` engine is explicitly included as the `.` npm workspace so release tooling still discovers it. Examples share the private `examples/package.json` workspace and strict TypeScript configuration; each keeps its own `src/`. The shared workspace consumes the engine through `file:..`. The website uses `file:..`. Install from the root with `npm ci` and retain the single root lockfile.

Run `npm run build`, then keep `npm run dev` in another terminal for incremental compilation. Rerun an example after a successful build; publishing or relinking is unnecessary. `npm run workspaces:check` checks consumer resolution and project structure; `npm run examples:typecheck` checks every example against public declarations. Use named workspace scripts rather than recursively invoking the root build across all workspaces.

## Example scope

Examples use public imports and strict TypeScript. Separate reusable drawing/timing functions from command entry points and file I/O. Render commands open saved state; verification must not modify its source project. Query targets explicitly and fail on missing or ambiguous results. Preserve the engine's conflict checks when saving revisions.

A fixture's story, visual treatment, layer naming, timing, material counts, or simulated agent transcript is not an engine contract. Documentation should state the operation demonstrated, required inputs, observable results, and limits. Derive API claims from implementation and tests. Keep structural assertions, pixel comparisons, manual visual review, and user acceptance distinct. Do not report the latter two merely because a script ran.
