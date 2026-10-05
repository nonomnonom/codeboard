# Codeboard character and presentation study

One project containing an eight-second performance and an optional scripted presentation. It is not a recording of an autonomous agent session.

## Local workspace

Install once at the repository root with `npm ci`, then run `npm run build`. The shared `examples` workspace uses the checkout's engine through `file:..`. Keep `npm run dev` running for engine changes and re-run after successful compilation.

```sh
npm run typecheck --workspace @codeboard/examples
npm run code-board-demo:author --workspace @codeboard/examples
npm run code-board-demo:render --workspace @codeboard/examples
```

For a downloaded ZIP, run `npm install`, `npm run typecheck`, then the corresponding `npm run` command from its extracted project directory. The ZIP includes the matching local engine build under vendor/ and installs it without waiting for engine publication. Third-party dependencies still require installation. Keep the generated lockfile.

## Source ownership

All implementation lives in `src/`. `src/config.ts` owns fixture settings. The shared `examples/tsconfig.json` enables strict checking against the engine's public declarations. `character/` is the sole source of pose types, geometry, and drawing functions. `study/` builds the short performance. `presentation/project/`, `presentation/scenes/`, `presentation/artwork/`, and `presentation/review/` build and inspect the film. `cli/` owns commands.

The story, geometry, materials, layer names, and timing are this fixture's inputs. They are not required project defaults. Public API behavior is described by the [online reference](https://codeboard.nonom.xyz/docs/reference/).

## Output and review

Generated files live in this project's `output/`, or the directory selected by `CODEBOARD_EXAMPLE_OUTPUT`. Authoring deliberately regenerates these files. Open saved artwork for revisions; keep independently revised projects out of a generator's output. Render commands read saved state. A generated image or passing assertion still needs visual review.

The short study writes `output/clawd.cboard`. The revise command changes only the drawing hold over `[126, 130)` and compares frame 128 before and after.

```sh
npm run code-board-demo:presentation:author --workspace @codeboard/examples
npm run code-board-demo:presentation:verify --workspace @codeboard/examples
npm run code-board-demo:presentation:render --workspace @codeboard/examples
```

Run these commands from the repository root. In a downloaded ZIP, use `npm run presentation:author`,
`npm run presentation:verify` and `npm run presentation:render` from the extracted directory.
The presentation writes `output/presentation/`; `CODEBOARD_DEMO_OUTPUT` may select another
presentation directory. Rendering reads the saved film and requires FFmpeg. The authoring pipeline
runs each stage in a separate process using the active package's declared CLI.

Clawd/Claude branding belongs to its owners; no affiliation or endorsement is implied. The generated terminal presentation is an authored illustration, not proof of agent behavior.

Pass `-- --movie` to the short study/story render command for MP4. FFmpeg is required. Host fonts may differ across platforms. Code is MIT; original synthesized audio is CC0-1.0.
