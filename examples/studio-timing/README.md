# Edit two shots without changing their animation

This ten-second example uses colored markers and generated tones to make timing changes easy to see and hear. Each source shot has 132 frames at 24 fps. The first edit uses 120 frames from each shot.

## Run the downloaded example

In the extracted `studio-timing` folder:

```sh
npm install
npm run typecheck
npm run author
npm run review
npm run revise
npm run revise
npm run review
npm run export
```

Export needs FFmpeg and ffprobe on PATH, or paths in `FFMPEG_PATH` and `FFPROBE_PATH`. The second `revise` call retries the saved request and returns its original receipt.

## Compare the result

Open `output/timing.cboard`, the review images and `output/timing.mp4`. Revision moves the second shot first and uses all 132 frames, then selects 108 frames from the first shot starting at frame 12. The movie remains 240 frames; source artwork and animation keys stay unchanged.

`output/revision-plan.json` and `output/revision-receipt.json` record the edit. `delivery.json` identifies the exported source version and movie. Listen to the tones around the cut as well as inspecting the images.

Authoring rejects an existing project. Review and export reopen the saved project rather than regenerate it. To try another authored version, use a new directory through the exported author function.

## Explore the source

`src/artwork/` draws the shots, `src/audio/` supplies their cues, `src/project/` authors and revises the project, and `src/review/` renders saved state. `src/config.ts` holds the timing settings.

In a Codeboard checkout, build the engine and use `npm run studio-timing:author --workspace @codeboard/examples`; substitute `review`, `revise` or `export` for the other actions.

`CODEBOARD_EXAMPLE_OUTPUT` selects the output directory for every action. A persisted revision plan must match this example's requested cut edit before commit; a different plan is rejected, rather than silently executed.
