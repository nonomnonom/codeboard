# Animate the Codeboard character

Make an eight-second walk, anticipation, hop and landing. The same character source also appears in an optional 48-second scripted presentation.

## Run the downloaded performance

In the extracted `code-board-demo` folder:

```sh
npm install
npm run typecheck
npm run author
npm run render
npm run revise
npm run render
```

The editable project is `output/clawd.cboard`. Revision changes the drawing hold over frames 126–129 and compares frame 128 before and after. Total timing remains unchanged. With FFmpeg installed, `npm run render -- --movie` exports the short performance.

Follow the [character tutorial](https://github.com/nonomnonom/codeboard/blob/main/examples/code-board-demo/TUTORIAL.md) to understand poses, placement and onion skins. `src/character/` is the shared drawing source; `src/study/` builds the short animation and `src/cli/revise.ts` edits its saved hold.

## Build the presentation

```sh
npm run presentation:author
npm run presentation:verify
npm run presentation:render
```

These commands write `output/presentation/`, or the path selected by `CODEBOARD_DEMO_OUTPUT`. Rendering opens the saved film and requires FFmpeg. The terminal scenes are an authored presentation, not a live agent recording.

Authoring refuses to replace saved projects. Select a new output location for another generation. Presentation verification is a separate command and reports checks against the saved film; authoring does not require a previous verification report. The short study's output root can be selected with `CODEBOARD_EXAMPLE_OUTPUT`.

## Run in the Codeboard checkout

Build the engine, then use `npm run code-board-demo:author --workspace @codeboard/examples`. Apply the same `code-board-demo:` prefix to `render`, `revise` and the `presentation:*` actions.

Code is MIT; original synthesized audio is CC0-1.0. Clawd/Claude branding belongs to its owners; no affiliation or endorsement is implied.
