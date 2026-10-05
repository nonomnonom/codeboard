# Distribution and runtime audit — 2026-10-06

The release contract is one `codeboard-studio` npm package containing the public
library and CLI. CI uses Ubuntu as its execution environment, with no OS matrix
or platform-specific runtime archives. User feature availability still depends
on Node, native renderers, codecs, fonts and filesystem behavior.

This audit covers local source, packaging, installation, tests, documentation,
plugin generation and release workflow wiring. It does not publish or deploy.
Version 1.0.0 remains a candidate. Earlier dated results in this directory describe
their own snapshots; this document supersedes their distribution-matrix claims.

## Findings and corrections

| Finding | Correction and proof |
| --- | --- |
| Testing and architecture docs still claimed cross-platform CI after its removal | Updated them to one CI environment and separate runtime compatibility requirements. Parsed all three workflows; checked job dependencies, runner selection and referenced npm scripts. |
| Source ZIPs could lag behind source while existing example tests still passed | Added `test/e2e/example-distribution.test.ts`. It reproduced a stale `agent-revision/README.md`, then passed after regenerating all seven ZIPs. It checks source membership/content, embedded tarball integrity, common runtime identity, dependency/entry-point metadata and compiled runtime content. Text comparisons normalize LF/CRLF; binaries retain exact hashes. |
| Version synchronization was a write operation, without a package-level assertion covering all consumers | Added an installed-package assertion for root lockfile, all plugin manifests and website release version. Plugin validation also compares its version with the engine. |
| Release could publish before discovering that the website could not build | Release validation now builds the website before packing/uploading the publish artifact. Installation and publication still download that same named artifact. |
| Website anchor validation repeatedly reparsed each target page | Cache each page's anchor set. The exported-site checker passes all 5,914 internal links/anchors across 125 HTML pages. |
| Installer migration remnants and duplicate runtime explanations survived the npm transition | Removed the dead website migration link and unused manual-download CSS. Installation docs now map requirements by operation; no unsupported OS/feature matrix was invented. |
| Generated plugin references moved out of source | Installation guidance uses `release/codeboard-plugin/`. Source docs and generated distribution links are checked in their respective owners. |
| A few Markdown punctuation characters were incorrectly encoded | Repaired affected README, troubleshooting and release-acceptance text. |
| Contributor instructions offered a manual publish path with fewer checks | Removed that alternate recipe; publication uses the validated-tarball workflow. |

## Distribution path

| Stage | Owner and invariant | Verification |
| --- | --- | --- |
| Compile | `scripts/build.mjs`, `tsconfig.json`; compiled engine under `dist/src` | Build/typecheck passed. Public example consumers resolve the local engine and declarations. |
| Pack | Root `exports`, `bin`, `files`, `engines`, runtime dependencies | Package tests reject repository tests/development sources in the archive. CLI shebang and npm command resolution are exercised by installed execution. |
| Install | npm global or project-local installation | Fresh tarball installation runs public API, CLI, known-pixel rendering, save/reopen, durable retry and non-overwriting starter creation. |
| Example downloads | `scripts/package-examples.mjs`; seven ZIPs with one matching engine | Current-source/runtime drift test passes. Studies also install dependencies from an empty cache and execute the bundled engine with media enabled. |
| Plugin | Source skills plus generated docs/examples in `release/codeboard-plugin` | Ten skills, manifests, 42 doc targets, source hashes, tamper rejection and rename/deletion behavior checked. Engine installation remains npm; skill installation follows the agent host. |
| Website | `docs/` is canonical; static Next output | Build, route normalization and exported links/anchors pass. npm publication check remains before deployment. |
| Release | `validate → install → publish` | Single tarball uploaded once, installed in a fresh job, then published. Tag/version checks and OIDC publication remain. Remote execution is not part of this audit. |

## Feature and test map

The catalog has 28 families: 8 `supported`, 20 `partial`. These are implementation
scope labels, not OS certifications. The table identifies principal test owners;
it does not claim every branch or every possible production project is covered.
Paths below are relative to `test/` unless stated otherwise.

| Catalog family | Status | Principal verification and retained limit |
| --- | --- | --- |
| `project.configuration` | supported | `integration/authoring/project-config`; explicit timing policy, seed is not global rendering control |
| `agent.discovery` | supported | `integration/authoring/inspection`, `object-query`; bounded detached queries |
| `agent.edit-plans` | partial | `integration/authoring/edit-plan/`; atomic draft, stale-version rejection and durable replay; payload limits remain |
| `storyboard` | supported | `integration/authoring/project`, `production`; contiguous global panel timeline |
| `drawing` | supported | `integration/drawing/`, `animation/drawing-sequence/`; editable vectors and RGBA8 pixels |
| `animation.curves` | supported | `integration/animation/animation-channels`, `evaluation`; sparse channels and explicit board/shot clocks |
| `animation.coordinates` | supported | `integration/animation/coordinates`; bounded inverse/mesh candidate handling |
| `timing.rational` | partial | `unit/rational-time`, `integration/animation/timing/`; explicit rounding, no drop-frame timecode |
| `animation.shot-retime` | partial | `integration/animation/shot-retime`; collisions reject, no audio stretching |
| `animation.rigging` | partial | `integration/animation/ik`, `controllers`, `deformation/`; explicit joints/weights, no automatic rig inference |
| `camera` | supported | `integration/animation/camera-channels`, `plane-depth`; 2D/depth-plane camera |
| `audio` | partial | `integration/animation/audio-tracks`, `audio-split`, `media/movie/`; board timing and movie mixing limits |
| `audio.studio` | partial | `media/studio-audio`, `integration/animation/studio-workflow`; sample/rational placement, actual decoder required |
| `render.jobs` | partial | `integration/storage/frame-storage`, `delivery/frame-job-recovery`; pinned input/resume checks, no scheduler |
| `assets.components` | partial | `integration/authoring/component-upgrade/`, `component-origins`; explicit conflict decisions |
| `review` | partial | `integration/delivery/review-verification` (API and CLI); source/hash binding, no authenticated artistic approval |
| `persistence` | supported | `integration/storage/`, `integration/delivery/project-publish`; atomicity, recovery, extraction and preserved data |
| `delivery.movie` | partial | `media/movie/`, `media/studio-example`; actual FFmpeg encoder, bounded dimensions/mix and explicit audio policy |
| `editorial.shot-local` | partial | `integration/animation/studio-workflow`, `shot-merge`; explicit source mapping and merge conflicts |
| `project.migration` | partial | `integration/storage/migration`; real historical files, original remains unchanged; before/after rendering on the current backend |
| `palettes` | partial | `integration/authoring/palettes`; solid-color bindings and explicit merge conflicts |
| `story.caption-import` | partial | `integration/authoring/caption-import`; existing panel IDs, no inferred matching |
| `story.script` | partial | `unit/script-fdx`, `integration/authoring/script`, `script-board`; bounded FDX subset and explicit bindings/loss reports |
| `compositing.effects` | partial | `e2e/studies-assets`, rendering/mask tests and effect studies; RGBA8, bounded effects, no OCIO/HDR |
| `compositing.graph` | partial | `e2e/studies-assets`, compositing graph studies; bounded acyclic shot graph, no editorial-level graph |
| `interchange.otio` | partial | `integration/delivery/otio`; one supported video cut track, unsupported structures reject |
| `interchange.psd` | partial | `integration/drawing/psd`; RGB8 pixel layers/groups subset, no PSD export |
| `animation.lip-sync` | partial | `integration/animation/lip-sync`; supplied cues and authored mouth drawings, no speech recognition |

No feature family was removed or promoted to fully supported by this audit.
The studies manifest maps all 28 families to examples; a mapping alone is not
proof of correctness. Actual study execution, independent pixel/media checks,
storage invariants and failure tests supply the narrower evidence.

## Evidence from this pass

Environment: Windows x64, Node 22.22.0, npm 10.9.4, FFmpeg/ffprobe 9.0.2.
CI remains configured for Ubuntu; it was not remotely executed in this pass.

| Check | Result |
| --- | --- |
| `npm run check` baseline | 507 tests in 116 files passed; build, lint, formatting, architecture, workspace, example types, docs and plugin passed |
| Added download freshness regression | Failed on stale delivered content before regeneration; passed afterward for all seven ZIPs |
| Latest example-source follow-up | Source was revised during the audit. After formatting, rebuilding and repackaging: 12 tests across download freshness, example workflow and documentation recipe suites passed |
| Final artifact follow-up | 3 checks passed: ZIP freshness plus studies in image and media projects; subsequent concurrent documentation edits remain outside that snapshot |
| Example lifecycle follow-up | 7 tests passed for saved-state rendering and preservation of existing user files |
| Final `npm run test:install` | 6 package tests passed, including the added release-version assertion |
| `npm run test:media` | 10 tests in 7 files passed with real media tools |
| `npm run test:studies:install` | Empty-cache dependency installation and bundled-engine execution passed; 32 images and 16 videos generated |
| `npm run website:build` | Passed; 125 HTML pages, 5,914 internal links/anchors |
| Dependency advisory audit | `npm audit --omit=dev`: zero reported vulnerabilities at audit time |
| Focused visual inspection | Opened fresh mesh-alpha, drawing-timing and script-board images; observed mesh identity/deformation, exposure boundary and caption changes described by the studies |

Local logs are under `.preview/distribution-audit-*`; the isolated studies run is
recorded in `.preview/studies-install/latest.json`. The baseline and added focused
tests are reported separately: they were not one frozen all-tests run.

## Concurrent-work handoff

The user confirmed that separate sessions are still editing tests and documentation.
The source fingerprint captured under `.preview/distribution-audit-snapshot.json`
detected further docs/API/example-fixture documentation edits during the final
checks. Do not treat the successful earlier checks as a frozen release verdict.
The distribution assertions remain in the normal test suite so these changes
cannot silently ship with older ZIPs or mismatched metadata.

When those edits settle, build once, regenerate example ZIPs and the plugin, then
run the integrated check, fresh package/studies installation, and website build.
Do not run multiple root builds concurrently. Keep all work local until the user
resumes the release stage. Ownership of the ongoing docs/test rewrites remains
with those sessions; this audit does not undo or repeatedly regenerate their work.

## Remaining boundaries

- No push, tag, npm publication or deployment was performed. Remote CI, registry
  publisher configuration, public installation and deployed URLs remain unverified.
- This pass does not certify Linux/macOS runtime parity or every Node/architecture
  combination. It does not assert identical native rasterization across systems.
- Coverage and mutation configurations were inspected; their earlier reports
  were not rerun as part of this pass. Mutation scope is two pure modules, not
  the entire engine.
- The documentation recipe tests using the checkout CLI establish recipe/source
  behavior. The fresh package and installed-studies tests establish distribution
  behavior. Do not label these as interchangeable evidence.
- Only the three named fresh images received visual inspection in this pass.
  Video encoding/decoding checks are technical evidence, not a full playback or
  artistic acceptance review of all outputs.
- Long-form studio load, all agent hosts, native Harmony exchange, full PSD/OTIO
  application interoperability and unsupported catalog behavior remain outside v1.
