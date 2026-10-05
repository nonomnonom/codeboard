# Documentation asset studies

This example workspace produces PNG images and MP4 videos for the documentation website. The study catalog covers the implemented portions of the runtime's capability families. The catalog distinguishes rendered artwork, views of actual inspected data, and explanatory diagrams. It does not turn missing features into simulated demonstrations.

The `color-import` study reads bundled sRGB and Display P3 PNG fixtures at 8-bit and 16-bit input depth. It checks normalized RGBA8 values, preserves alpha, rejects a damaged ICC profile, and saves/reopens editable swatches with render parity. Its report includes input hashes and decoded channels. Source profiles and 16-bit precision are not retained in editable pixels; this study does not demonstrate high-precision compositing.

The `psd-import` study compares independent RLE/ZIP fixtures, retains editable pixel layers and
group opacity, and commits a one-pixel correction with reopen/retry checks. It reports omitted
metadata and rejects effects/clipping fixtures. It demonstrates the explicit untagged RGB8
subset, not PSD export or arbitrary Photoshop documents.

The `frame-jobs` study also exercises the shot compositing graph: separate layer sources,
animated grading and blend opacity, a mask, saved graph edits and editorial job parity.
Its output includes selected graph frames and manifests; this is fixture evidence, not
qualification of every graph/effect combination or production color pipeline.

Its separate `shot-retime` workflow module prepares a 12-to-24-frame shot revision, saves
`retime-plan.json`, commits the shot and editorial cut together, reopens/replays the receipt,
and compares frames 22/0/10 against source frames 11/0/5. It writes `retimed-shot.cboard`,
`retimed-editorial.sqlite`, `shot-retime.png` and timing/report data in `progress.json` while
preserving the original job sources. This added workflow is statically checked, not yet run;
it has no audio clips and does not qualify audio retiming or the other deformer/controller domains.

## Local workspace

The `audio-delivery` study includes a separate board-capture module. It prepares
`audio-board-capture.cboard`, its saved plan, `audio-board-capture.wav` and `audio-held-shot.wav`.
The module checks source preservation, reopen/replay, exact trim/fade sample counts, converted
editorial PCM against the original shot mix, and shot/sequence audio placement during an initial
picture hold. It uses the existing FFmpeg decoder and runs with the media studies. These new
checks are prepared and statically verified, not yet executed; they do not qualify other codecs,
fractional clocks, resampling or transition-audio policies.

Install once at the repository root with `npm ci`, then run `npm run build`. The shared `examples` workspace uses the checkout's engine through `file:..`. Keep `npm run dev` running for engine changes and re-run after successful compilation.

```sh
npm run typecheck --workspace @codeboard/examples
npm run studies:author --workspace @codeboard/examples
npm run studies:author --workspace @codeboard/examples -- --video
```

The author command generates the non-media image studies without external media tools. `--video` adds the audio delivery study and motion videos; install FFmpeg and ffprobe or set `FFMPEG_PATH` and `FFPROBE_PATH`. The audio input is generated locally. Labels use the host's sans-serif font.

For a downloaded ZIP, run `npm install`, `npm run typecheck`, then `npm run author -- --video` from its extracted project directory. The ZIP includes the matching engine build in `vendor/`; it does not wait for npm publication. Installation still downloads the engine's third-party dependencies. Keep the generated lockfile.

Repository maintainers can run `npm run test:studies:install` to verify the current ZIP using
a fresh directory under `.preview/studies-install/` and an empty npm cache. It installs dependencies from the public npm
registry, including their normal install scripts, then uses the extracted project's TypeScript
and engine to generate the studies. Set `FFMPEG_PATH` and `FFPROBE_PATH` to include video checks.
The command retains the extracted project, lockfile, install log and dependency tree; successful
runs write `.preview/studies-install/latest.json` with artifact hashes and the output manifest.
This verifies installation independently of checkout dependencies on the current host; it does
not substitute for a different-machine test of fonts, codecs and native libraries.

## Source ownership

The optional capacity workload is separate from normal website asset generation:

```sh
npm run studies:workload --workspace @codeboard/examples -- ../../.preview/workload-24-shot
```

Use a new destination and configure FFmpeg/ffprobe as above. This authors 24 independently
captured shots over 180 seconds at 24 FPS, using six repetitions of the exchange fixture.
It renders 4,320 frames, cancels after two shots, resumes, verifies every stored checksum,
compares three frames per shot with direct rendering, retries the completed job and encodes
a movie whose decoded frame count/rate/duration are checked. The directory retains the
editable project, SQLite frame job, movie and `report.json` with timings, hashes, hardware,
renderer identity and Node process peak RSS. The script does not overwrite an existing run.

This initial workload uses 360×280 picture output and no audio. It measures preview-resolution
capacity and cooperative recovery; it is not the full M6 film, production-resolution,
clean-machine or artistic qualification. Mouth cues occupy the first second of speaking
shots; the remaining time is held. In a downloaded ZIP use `npm run workload -- <new-directory>`.

All study implementation lives in `src/`. Package and TypeScript configuration are shared
at `examples/`; a downloaded ZIP receives its own generated configuration.

| Location | Responsibility |
| --- | --- |
| `config.ts` | Canvas, frame rate, colors and output root |
| `catalog.ts` | Study IDs, capability coverage and video targets |
| `studies/drawing/`, `animation/`, `assets/`, `audio/`, `story/`, `workflow/` | One focused feature study per module |
| `shared.ts`, `shared/` | Drawing helpers, labelled image sheets, reports and the reused motion fixture |
| `fixtures/` | Authentic legacy migration and official OTIO inputs with provenance |
| `cli/run.ts` | Dependency checks, execution, saved-project verification and manifest |

The shared `examples/tsconfig.json` enables strict checking against public engine declarations. New implemented capability families must have a catalog entry or generation fails. This checks documentation coverage, not every API combination or production qualification.

The story, geometry, materials, layer names, and timing are this fixture's inputs. They are not required project defaults. Public API behavior is described by the [online reference](https://codeboard.nonom.xyz/docs/reference/).

The `controller-exchange/` study separates character construction, four-shot authoring, mouth performance, arm deformation and saved-project rendering. It produces a two-character card exchange as PNG and a 96-frame editorial movie, preserving base keys beneath replacement/additive controllers. Both arms retain editable cubic curve controls beneath the reach controllers. Generation compares the rest pose byte-for-byte before and after binding and verifies saved curve controls. Sender and receiver use editable mouth holds in their speaking shots, including a manual closure at frames 10–12. Saved palette revisions change all four shots while retaining the receiver sleeve's local override. Generation verifies these properties, receipt replay and backward seeks after reopening; `controllers.json` retains the evidence. Mouth cues and card motion are explicitly authored. The study has no recorded dialogue, automatic audio alignment or attachment solver, and does not qualify a complete production character rig.

## Output and review

Each run creates a fresh `output/run-…/` directory, or a fresh directory under `CODEBOARD_EXAMPLE_OUTPUT`. An explicit first argument selects a new output directory; existing destinations are rejected. Each study has its own folder containing the editable `.cboard`, documentation PNG, optional MP4, and any supporting reports/WAV/stems. Open saved artwork for revisions. Frame jobs pin their source file: keep its location, or supply `sourcePath` when reopening a copied job.

`manifest.json` records generated and skipped studies, capability constraints and pending visual review. Audio placement and hierarchy are explanatory diagrams; script cards and the audio amplitude image display inspected record/sample data. They are labelled separately from rendered artwork.

From the repository root, `npm run docs:assets -- --video` regenerates the studies, verifies saved projects, copies the documentation images/videos to `website/public/art/guides/`, writes `studies.json`, and packages downloadable source. Review the images and video before publishing the website. Generated assets are documentation evidence, not artistic approval or a production-readiness claim.

The `weighted-pose` source demonstrates shot-local replacement/additive pose baking through a saved edit plan. It commits and retries the same request, reopens the project, then writes a three-frame comparison and `pose-bake.json` with keys and receipts. Additive scale is a numeric delta, not a multiplier. The runner generates its PNG/movie and receipt report. These artifacts do not qualify all pose-baking combinations.

The `rig-rest` source captures a local two-bone rest pose and authors an IK reach in a saved plan, reopens the project, then applies the stored rest in a second plan and retries that request. A final reopen supplies the three-frame sheet, optional shot movie and `rest-pose.json` containing plans, receipts, saved rig data, keys and evaluated transforms. Frame-zero keys anchor the initial pose before later sparse keys are introduced. The runner generates the PNG/movie and records save/reopen/retry results. The report exposes restoration transforms for review; it does not by itself prove every rig-rest case.

The `mesh-warp` source binds two nested group meshes through a saved edit plan, reopens the file, retries the same request and reopens again. The retained shot supplies a three-frame checker-grid sheet, optional shot movie and `mesh-coordinates.json` containing bindings, plan receipts and forward/inverse point candidates. The artwork includes translucent fills and a shared triangle edge for later seam inspection. The runner generates its PNG/movie and coordinate report. Focused deformation and mesh-render regressions separately cover the documented pixel, coordinate, seek and persistence cases; arbitrary nested configurations remain unqualified.

The font-preflight study also creates `pinned-font.cboard` and `pinned-font.sqlite` using the bundled OFL-licensed DM Sans fixture. It copies the font and license beside the source, checks a deliberate checksum mismatch, then resumes with restored bytes. This pins the declared title font; contact-sheet labels and other host fonts are not covered.
