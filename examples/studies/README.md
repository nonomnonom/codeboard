# Explore Codeboard through small studies

These modular studies generate the comparison images used directly in the Fumadocs feature guides. Each generator exercises the public API and saves its project, rendered pictures and relevant reports.

Read the feature guide alongside its pictures, then use the corresponding source here to reproduce or change the demonstration.

## Run the downloaded studies

```sh
npm install
npm run typecheck
npm run author
```

Run from the extracted `studies` directory. The ZIP contains the matching engine package and fixtures; npm downloads its dependencies. Keep the generated lockfile.

For motion and decoded audio, install FFmpeg and ffprobe, then run `npm run author -- --video`. `FFMPEG_PATH` and `FFPROBE_PATH` select specific executables. Audio inputs are generated locally; labels use the host's fonts unless a study pins a font file.

## Find a technique

| Source under `src/studies/` | Try it for |
| --- | --- |
| `drawing/` | Brush tips, pressure, contours, masks, blends, gradients and perspective guides |
| `animation/` | Onion skins, easing, pivots, holds, rigging, deformation, camera and cuts |
| `assets/` | Components, conflict-aware upgrades and PSD input |
| `audio/` | Trim versus placement, replaced media and decoded delivery |
| `story/` | Script records, captions and storyboard hierarchy |
| `workflow/` | Saved revisions, merges, migration, review, fonts and resumable renders |

The [asset index](GALLERY.md) links pictures to their source. `src/learning/` owns the descriptions and captions used in docs; `src/catalog.ts` connects studies to their generators. `src/config.ts` contains shared drawing settings.

## Inspect the outputs

Every run creates a new `output/run-…/` directory. Pass a new directory explicitly with `npm run author -- /absolute/new-output --video`. Existing destinations reject instead of being replaced.

Open a study’s PNG to inspect its comparison. `steps/` retains the individual full-size renders and `comparison.json` records their captions. The `.cboard` is the editable project; generated MP4 files demonstrate motion or sound.

Each study directory contains its editable `.cboard`, images and any JSON reports. The hierarchy and audio-placement pictures are diagrams. `manifest.json` records generated outputs and media studies skipped when FFmpeg is not requested.

The complete PNG comparison sheet remains available for documentation and sharing. `steps/` preserves each rendered sample separately; `comparison.json` records its caption and dimensions. The main mesh, editorial and frame-job comparisons focus on one question; additional workflow checks remain in separate artifacts.

Frame jobs depend on their saved source: keep it unchanged, or supply the matching `sourcePath` when relocating a job. The pinned-font study includes an OFL font and license; its pin does not cover other fonts on the computer.

## Run a longer render workload

`npm run workload -- /absolute/new-workload` creates 24 captured shots over 180 seconds at 24 fps. It renders 4,320 frames at 360×280, cancels and resumes, verifies stored checksums, compares selected direct renders and encodes a movie. FFmpeg and ffprobe are required.

The workload has no audio. It measures this preview-resolution fixture, not every production configuration. It retains the editable project, job, movie and `report.json` with timings, renderer identity and memory observations.

## Work in the Codeboard repository

Build the engine, then run `npm run studies:author --workspace @codeboard/examples`, adding `-- --video` for media. For the workload use `npm run studies:workload --workspace @codeboard/examples -- /absolute/new-workload`.

Maintainers can update website assets with `npm run docs:assets -- --video` and check the standalone ZIP with `npm run test:studies:install`. See the [documentation maintenance guide](https://github.com/nonomnonom/codeboard/blob/main/contributing/documentation.md) for publication steps.

`src/project/generate.ts` owns the batch; `src/catalog.ts` associates focused generators with documentation topics. These associations do not certify framework coverage. Each generated result records dimensions from a decoded PNG plus the opened project identity/version, after storage verification. Authoring errors propagate and do not become a successful manifest entry.
