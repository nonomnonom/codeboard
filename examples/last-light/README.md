# Last Light

Run a fictional fourteen-panel storyboard with generated audio, then revise its saved artwork. Use it to explore a larger project with separate scene, drawing and sound modules.

## Run the downloaded story

```sh
npm install
npm run typecheck
npm run author
npm run render
```

Run these commands from the extracted `last-light` folder. Inspect the images and editable project in `output/`. With FFmpeg installed, use `npm run render -- --movie` for an MP4.

## Revise the saved story

Run `npm run revise`, then `npm run render` again to inspect the changed result. Authoring reserves a new output directory before producing assets and refuses existing destinations. Use render or revise for existing work. `CODEBOARD_EXAMPLE_OUTPUT` selects another output root.

Look in `src/scenes/` for individual shots, `src/artwork/` for reusable drawing functions and `src/audio/` for sound. `src/project/` assembles the story; `src/review/` renders saved state.

## Use the local engine

From the built Codeboard checkout, run `npm run last-light:author --workspace @codeboard/examples`. The other actions use the same prefix, such as `last-light:render` and `last-light:revise`.

Code is MIT. Original artwork and synthesized audio are CC0-1.0. Fonts depend on the rendering computer.
