# Testing Codeboard

Tests belong to the behavior they verify. Vitest runs native Node forks with file isolation; imports, mock restoration, timeouts and project selection are configured in `../vitest.config.ts`. No custom runner or ambient test globals are required.

## Where tests live

| Directory | Responsibility |
| --- | --- |
| `unit/` | Pure timing, pixel operations, history, hatching and script parsing. Import the owning source module. |
| `integration/authoring/` | Public project operations, edit plans, ownership, transactions, components and scripts. |
| `integration/animation/` | Evaluation, clocks, exposures, rigs, audio placement and timeline edits. |
| `integration/drawing/` | Brush input, geometry, pixels, color and resource import. |
| `integration/storage/` | Save/open, revisions, recovery, migration and partial storage access. |
| `integration/render/` | Rendering, layouts, parity and a real preview HTTP server. |
| `integration/delivery/` | Fonts, exports, publishing, review manifests and OTIO interchange. |
| `e2e/` | CLI processes, packaged public API, starter scripts and downloadable examples outside the checkout. |
| `media/` | Real FFmpeg/ffprobe encoding, decoding, audio and delivery. Missing tools fail this project. |
| `fixtures/` | Stored external formats and historical schemas, with provenance and regeneration instructions. |
| `support/` | Environment setup shared across a whole test project. |

Large domains have their own subfolders: `authoring/edit-plan`, `authoring/transactions`, `authoring/component-upgrade`, `animation/timing`, `animation/drawing-sequence`, `animation/deformation`, and `media/movie`. Put reusable domain setup in the adjacent `fixture.ts`; keep assertions in the scenario files. Split by behavior, not a target number of lines. Do not grow a universal test helper with unrelated responsibilities.

## Commands

| Command | What it verifies |
| --- | --- |
| `npm test` | Builds current source, then runs unit, integration and E2E. |
| `npm run test:unit` | Pure tests without a build. |
| `npm run test:integration` | Builds and runs integration tests. |
| `npm run test:e2e` | Builds and runs command-line/package/example flows. |
| `npm run test:media` | Builds and runs media tests plus study delivery with video enabled. |
| `npm run test:all` | Builds and runs every project, including media. |
| `npm run test:coverage` | Core projects with V8 HTML, LCOV and JSON reports in `coverage/`. |
| `npm run test:mutation` | Stryker changes timing/pixel implementation operators and checks whether unit tests detect them. |
| `npm run test:package` | Archived runtime assertions using already-installed dependencies. |
| `npm run test:install` | Installs a fresh archive in a disposable directory and runs the package assertions. Requires registry access. |
| `npm run test:studies:install` | Runs study sources against a fresh package installation. Requires registry access. |
| `npm run check` | Build, lint, formatting, architecture, workspaces, examples, core tests and documentation/plugin checks. |

For one suite: `npm test -- test/integration/authoring/project.test.ts`. For a domain: `npm test -- test/integration/authoring/edit-plan`. Do not run separate build commands concurrently: the build replaces `dist`, which CLI and package tests consume. In watch mode (`npm run test:watch`), rebuild before checking behavior that launches the compiled CLI.

Media setup uses `FFMPEG_PATH` and `FFPROBE_PATH`, falling back to commands on `PATH`. Both must execute successfully. Set `SKIA_CANVAS_THREADS=2` on constrained machines. Tests use temporary directories and localhost port 0; avoid fixed ports, shared output paths and order dependencies.

## Evidence and limits

Each new regression needs an observable contract: inputs, expected result, and the bug it would catch. Expected values should come from the format specification, manually calculated arithmetic, known RGBA bytes, a stored independent fixture, or an externally decoded result. Testing a renderer against itself establishes consistency, not image correctness; retain parity tests for consistency and add independent pixel expectations where deterministic.

`unit/rational-time` checks exact fractions and rounding errors. Pixel tests compare explicit channel bytes and reject malformed input. `integration/render/preview-http` sends actual HTTP requests, decodes responses with Sharp, checks boundaries, and verifies the source file stays unchanged. `e2e/package` packs the runtime, runs its CLI outside the repository, reopens edits and decodes a known rendered image. Its default dependency links are intentional; only `test:install` claims fresh dependency installation. `e2e/example-distribution` compares every source ZIP against current example files and the compiled engine, including the bundled tarball integrity. Regenerate downloads with `node scripts/package-examples.mjs` after building when these inputs change.

Coverage includes all `src/**/*.ts`, including untouched files. It measures execution, not assertion quality. Separately spawned CLI processes and media runs are not included in the core V8 totals. There is no invented global coverage threshold. Inspect uncovered branches and regressions before deciding where more tests help.

Mutation testing currently covers **only** `src/animation/rational-time.ts` and `src/drawing/pixel-buffer.ts`. Reports go to `coverage/mutation/`; run it after coverage because coverage cleans its output directory. Surviving mutations need review: some reveal missing cases, while equivalent changes or diagnostic wording do not necessarily change the contract. Do not weaken tests or exclude mutants just to improve a score. Vitest and its coverage provider are pinned together to 4.1.11. Stryker uses its built-in command runner to launch the three selected unit files in a fresh Vitest process for each mutation. The scoped `typed-rest-client` override keeps Stryker's transitive `qs` dependency patched.

Automated results do not establish animation aesthetics, readability, or user acceptance. Changes to artwork still require inspecting rendered images or playback. The preview endpoint tests exercise the HTTP API; they do not claim browser UI coverage.

CI uses one Ubuntu runner environment for core checks and fresh npm package installation, with separate required media, coverage and mutation jobs. These checks do not qualify every user OS or native dependency build. The mutation gate is 85% for the two named modules. This floor allows surviving diagnostic and equivalent mutations while detecting substantial loss of behavioral assertions; it is not a claim about repository-wide test quality.

The Vitest-specific Stryker adapter was removed after it reported surviving multi-file mutations with zero completed tests, even when coverage selection was configured off. The built-in command runner checks the actual Vitest exit code. It reports one command as one test; that command runs all three selected unit files. This costs more process startup time and avoids relying on the adapter's test-name selection.
