# Lengkap

An editable fifteen-second story told in six scenes with brush strokes and synthesized Foley. The story is fictional satire.

## Run the downloaded story

```sh
npm install
npm run typecheck
npm run author
npm run render
npm run verify
```

Use the extracted `lengkap` folder as the working directory. Open the project and images in `output/`. Install FFmpeg and run `npm run render -- --movie` to export a movie with sound.

## Inspect and change the work

Edit a scene in `src/scenes/`, brushes in `src/artwork/`, or sound in `src/audio/`. Choose a new output directory for another author run. `CODEBOARD_EXAMPLE_OUTPUT` selects the output root; render and verify reopen existing work.

The verification command checks timing and saved artwork, then performs edit/save/undo experiments on a separate copy under `output/review/`. It checks that the original source file stays unchanged. Review the images and listen to the movie yourself before accepting an artistic change.

## Run in the repository

After building the engine, use `npm run lengkap:author --workspace @codeboard/examples`. The matching actions are `lengkap:render` and `lengkap:verify`.

Code is MIT; original artwork and synthesized audio are CC0-1.0. Rendered text can differ with the installed fonts.

Authoring requires a new output directory and never overwrites existing projects or audio. Set `CODEBOARD_EXAMPLE_OUTPUT` to choose another destination. Both author and render use `src/review/render.ts`; verification edits a separate copy.
