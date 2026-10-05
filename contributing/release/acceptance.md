# Codeboard v1.0.0 release objective

Target version confirmed by the user: **1.0.0**, 2026-10-06.
Current stage: **final review and authorized publication**. On 2026-10-06 the
user resumed release work, confirmed parallel edits had ended, and authorized
review, fixes and publication. Validate the final combined tree before release.
A local version of 1.0.0 remains a candidate until publication is verified.

Before returning to release work, finish the local implementation audit across
API/CLI, storage/migration, rendering/audio, examples/docs and plugin. Resolve
inconsistent contracts, record actual limits and run the affected local checks.

Objective: publish the validated v1 npm package and matching website, docs,
examples and plugin, then verify public installation and record the release.
The [A–Z audit](audit-2026-10-06.md) provides the evidence and findings
behind this cutoff. Checklist completion requires evidence, not just implementation.

The [distribution/runtime audit](distribution-audit.md) records the latest npm-only
pipeline decisions and local checks.

This document defines the active release scope and finite completion criteria.
Technical evidence qualifies only the behavior and environment it actually checks.

## Stop adding features

Ship the existing editable 2D workflow: create artwork, save, reopen, inspect,
revise, assemble shots, add audio, review and export. Keep existing drawing,
rigging, compositing, asset and agent operations within their documented limits.
The renderer's RGBA8 boundary and supported interchange subsets are acceptable
release limits. API presence alone is not evidence of correct execution.

Accept a change only when it fixes data loss, an incorrect supported result,
installation, a documented workflow, or release consistency. Finish partially
wired operations already in this tree. Do not add another capability family,
configuration system, orchestration layer or showcase film.

Deferred: full Harmony/Storyboard Pro parity; HDR/float/linear/OCIO composition;
native Harmony interchange; additional interchange formats; built-in scheduler,
autosave service or GUI authoring; broad artwork refactors without a release bug.
Long-form studio workload qualification remains future work and must not be
implied by this release's narrower proof.

## Audit findings

| Finding | Release action |
| --- | --- |
| Root roadmap lists script, deformation, lip sync and other implemented areas as absent | Replace the obsolete feature table with this finite release contract and current guide links |
| Public CLI guide says migration writes schema 4, while model/schema/project.ts requires 5 | Reconcile migration instructions against the actual migration implementation and fixtures |
| Agent workflow still describes editorial audio/mixing as pending | Rewrite current usage against the implemented APIs; move historical status into internal evidence |
| Review verification and decision APIs have static-only qualification notes | Exercise package corruption, decision binding, stale source, named revision and CLI options before declaring support verified |
| review-verify eagerly imports export/package-file.ts | Use the existing lazy command-loading pattern; rerun architecture check |
| Historical npm run check passed 397 tests in 90 suites | Retain that evidence but run final checks on the frozen release tree; it predates the last review additions |
| 174 pending changesets include 2 major, 65 minor and 107 patch entries | Reconcile release notes and superseded schema descriptions before versioning; do not interpret the count as versions |
| Package/plugin/website currently identify as 0.3.0 | Synchronize the selected release version, generated references and standalone example bundles |
| Website deploys main independently of tag-based npm publication | Coordinate publication so installation instructions and deployed docs describe an available package |

Audit checks on 2026-10-06: root TypeScript, workspace resolution, generated API
references, 1,584 Markdown link targets and 195 bundled plugin source files passed.
Architecture initially failed on the new review command's eager import. These
checks do not establish runtime or deployment readiness.

After changing that import to command-time loading, architecture passed at 367
source modules and 1,171 runtime edges. Root TypeScript and scoped CLI lint passed
again. No build, runtime tests or publication were performed in this audit.

## Documentation cutoff

Keep one maintained public guide set in docs/. Reuse the existing fundamentals,
concepts and production workflow structure; rewriting everything from scratch
would discard useful examples and links without improving the release contract.
Rewrite outdated sections as current instructions, supported limits and examples.
Remove superseded claims and duplicate implementation diaries from public guides.
Preserve migration guidance and old-project protections.

The contributing/release directory contains the v1 objective and candidate audits;
contributing/architecture.md owns implementation boundaries. Generate API pages and plugin references from their
existing sources. Check links after removing or consolidating old material.

## Example cutoff

Use three existing examples as the supported onboarding path:

1. quickstart: install, author, save, reopen and render an editable drawing.
2. studio-timing: shot-local animation, editorial, review and audio delivery.
3. agent-revision: inspect, plan, commit, retry and continue from saved state.

Keep studies as targeted feature proofs and documentation generators. Keep
last-light, lengkap and code-board-demo as optional showcases, not additional
requirements for a new user. Do not create another example framework. All
distributed downloads must still install and run with the matching bundled engine.

## Finite acceptance gates

- [x] Reconcile the dangling review CLI/API/docs and stale timing/audio/migration
  statements. Verify new board capture/holds and discovery against saved projects.
- [x] Finish docs and example entry points; synchronize plugin guidance, generated
  API references and downloads. No public instructions using proposal signatures.
- [x] After static readiness, run npm run check and focused runtime proofs for
  changes absent from the previous full run. Prove save/reopen, stale-write
  rejection, durable retry and migration preserving the original file.
- [x] Run the three onboarding workflows using the candidate package. Inspect a
  rendered frame and an exported short movie with sound; verify timing and a
  targeted saved-state revision. Technical success does not imply artistic approval.
- [x] Run package/install verification, standalone example installation and the
  website build. Check a fresh installation of the same npm artifact in release CI.
- [x] Review the diff for accidental outputs, duplicate configuration and obsolete
  docs; reconcile changelog, engine/plugin/site versions and migration notes.
  Changesets status resolves to 1.0.0, matching the confirmed user objective.
  Run versioning and inspect private file-dependency warnings before
  publication. Use the repository's versioning flow; do not reuse 0.3.0.
- [ ] Publish the validated artifact through release CI, deploy matching docs,
  verify public installation and URLs, and record the released commit/tag/version.
  Repository workflows alone do not prove remote deployment is configured or passed.

Stop when these gates pass. Remaining research items belong to later releases.
If a supported workflow fails, fix its root cause and rerun the affected proof;
do not expand the feature scope to compensate. Do not label this candidate ready,
deployed or workspace-clean before the corresponding evidence exists.

## Candidate verification — 2026-10-06

The completed local gates supersede the audit-time status above. Engine, lockfile,
plugin and website now identify 1.0.0; the changesets have been consumed and the
v1 changelog describes the final schema-5/container-3 contract. Version sync preserves
manifest formatting and rejects an absent or ambiguous website declaration.

- `npm run check`: 406 tests / 93 suites passed, including media tests with both
  FFmpeg and ffprobe configured. Lint has 16 existing website warnings, no errors.
- `npm run test:install`: freshly installed tarball passed public API, save/reopen,
  targeted revision, integrity and CLI authoring checks.
- `npm run test:studies:install`: clean standalone install passed with video enabled.
- Three extracted onboarding ZIPs installed and typechecked independently;
  quickstart authored artwork, studio-timing reviewed/revised/replayed/exported,
  and agent-revision committed and replayed its original receipt.
- The installed studio movie contains 240 H.264 frames and 10 seconds of 48 kHz
  AAC audio. The delivery mix has 480,000 samples and zero clipped samples.
  The test suite decodes cue/silence windows; no artistic or listening approval
  is claimed. Quickstart artwork and the movie contact sheet were visually inspected.
- Website build passed: 3,680 internal links/anchors across 43 exported HTML pages.
- Six API pages and 195 bundled plugin source files synchronized; reference
  tampering/drift checks passed. This is not a new autonomous-agent evaluation.
- 33 guide images, 16 videos and seven example ZIPs regenerated from v1. Historical
  showcase media remain labeled; obsolete source ZIPs are removed.
- Private workspace `file:..` warnings from Changesets do not change the dependency
  contract: workspace resolution, typechecks and the updated lockfile pass.

Local logs and installed evidence are retained under `.preview/release-audit/`
and `.preview/studies-install/latest.json` (ignored development outputs).
Remote CI, npm publication and website deployment are deferred
until the user resumes release work. The initial remote run found backend-specific
test assumptions; those findings remain part of the local verification review.

## Local stability review — 2026-10-06

Storage extraction review reproduced two defects through the public ProjectStore
API: valid `..media/` paths were rejected, and a pre-existing directory junction
could redirect extraction outside the destination. The storage owner now checks
the actual parent components and output entry, rejects links and non-regular
entries, and distinguishes a parent traversal from a dot-prefixed filename.
Four regression tests cover these cases and existing-file preservation. Three
failed against the previous implementation; all four pass after the fix, along
with the persistence and storage-query suites (13 tests total).

The extraction guide, bundled plugin reference and seven downloadable examples
were synchronized with the rebuilt engine. Extraction remains incremental and
requires a trusted destination without concurrent filesystem replacement.

Release decisions from this review:

- Keep the existing editable 2D workflow and its storage/migration protections.
  No reviewed evidence warrants removing a supported capability for v1.
- Implement concrete correctness fixes in their existing owners; do not add new
  feature families or replace the architecture to obtain a v1 label.
- Remove obsolete support claims when identified, but preserve historical
  fixtures, migration coverage and generated distribution references.
- npm is the single runtime distribution channel; there are no platform installers.
  Runtime compatibility is separate: CI uses one Ubuntu environment; document
  feature-specific environment limitations when verified.
- The 16 website lint warnings were closed in the follow-up below. This review
  does not qualify every UI interaction or studio scale.

The final `npm run check` passed: 414 tests in 96 suites, zero skipped, with
FFmpeg and ffprobe configured. Build, lint (16 warnings, no errors), formatting,
architecture, workspace checks, example typechecks, docs/plugin synchronization
and packaged API/CLI checks passed.

Fresh tarball installation and API/CLI smoke checks passed. The website production
build passed with 3,682 internal links/anchors across 43 exported HTML pages.
Logs for this review are `.preview/v1-install-check.log`,
`.preview/v1-website-check.log` and `.preview/v1-final-check.log`.

### Website maintenance follow-up

Website lint now has zero warnings and errors. CSS rules were reordered without
changing their declarations. The obsolete react-remove-scroll body override was
removed: the active home/docs layouts use Base UI scroll locking, which already
handles stable scrollbar gutters. Reduced-motion overrides remain intentional,
with narrowly scoped lint explanations. The lazy pose-sheet image also retains
its intrinsic dimensions and native element: this static export disables Next
image optimization, so replacing it would not add an optimization service.

`npm run lint` now fails on warnings to prevent unnoticed lint regressions.
Formatting and the production website build pass; the build verifies 3,682
internal links/anchors across 43 exported HTML pages.

Local browser checks covered the examples page at desktop/mobile widths, mobile
home and project docs without horizontal overflow, search results and Escape
dismissal, mobile navigation/sidebar, and the dark theme toggle. With reduced
motion emulated, the home button transition resolves to `0s` and scrolling to
`auto`. Remote engine CI still requires a separate run; no remote release
action was performed in this follow-up.

Browser inspection also reproduced a Windows static-export defect in the installed
Next.js exporter: segment paths from `path.relative()` contain backslashes, while
the filename encoder replaces only forward slashes. Browser prefetch requests
therefore returned 404 even though HTML link validation passed. The website build
now normalizes only those generated segment directories to the expected dotted
filenames. Flat exports are unchanged; collisions fail without overwriting the
destination or deleting the source. Two regression tests pass, root typecheck
passes, and the complete website build normalized 41 paths. Browser navigation
from home to examples to docs passed, with all observed segment requests returning
200 after the fix. Revisit this workaround when updating Next.js.

At the end of this follow-up, an independent working-tree migration moved tests
into unit/integration/e2e/media directories and replaced Jest with Vitest. The
earlier global check results describe the pre-migration snapshot. A subsequent
global formatting check found ten errors in the migration's changed files; those
changes are outside this website fix. Re-run the complete gates after that work
settles before claiming the current combined tree passes.

## Final combined-tree verification — 2026-10-06

The user ended parallel editing and authorized review, fixes and publication.
The final source regenerated 56 guide images, 25 videos and all seven example
downloads. Visual studies now appear in the corresponding framework guides.

`npm run check` passed with 524 tests in 119 files, including strict lint,
formatting, architecture, workspace/example types, API documentation and plugin
validation. Media passed 10 tests in seven files. Fresh package installation
passed ten tests; a fresh standalone studies install passed with video enabled.
The website build verified 5,936 links and anchors across 125 HTML pages.
Plugin validation covered ten skills, 132 bundled sources and 43 engine targets.

Logs are retained locally in `.preview/final-release/`. These results supersede
the earlier local counts; remote CI, publication and deployment still require
their own successful runs before the release gate can be marked complete.
