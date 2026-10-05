# Draw your first stroke

Make a pressure-sensitive curved stroke, save its editable project and render frame 47 as a PNG. Change the color, brush size or control points to see how the mark responds.

## Run the downloaded example

Open a terminal in the extracted `quickstart` folder:

```sh
npm install
npm run typecheck
npm run author
```

Open the PNG in `output/`. The `.cboard` beside it keeps the editable stroke. FFmpeg is not required. The ZIP includes a matching engine package; npm installs its dependencies.

## Change the drawing

Edit `src/project/author.ts` to change the mark. Canvas size, frame rate and background are in `src/config.ts`. Use a new output directory for another author run; existing projects are preserved. Use `npm run render` to render the saved project, including your edits, without authoring again.

An output directory can be passed as the first argument: `npm run author -- /absolute/new-output`. `CODEBOARD_EXAMPLE_OUTPUT` also selects the default output root.

## Run from the Codeboard checkout

After installing and building the engine at the repository root, run `npm run quickstart:author --workspace @codeboard/examples`. See the repository's [example workspace guide](https://github.com/nonomnonom/codeboard/blob/main/examples/README.md) for shared development commands.
