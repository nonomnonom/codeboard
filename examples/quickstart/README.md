# First stroke

A pressure-sensitive raster stroke, stable IDs, an editable save, and a PNG at frame 47.

## Local workspace

Install once at the repository root with `npm ci`, then run `npm run build`. The shared `examples` workspace uses the checkout's engine through `file:..`. Keep `npm run dev` running for engine changes and re-run after successful compilation.

```sh
npm run typecheck --workspace @codeboard/examples
npm run quickstart:author --workspace @codeboard/examples
```

For a downloaded ZIP, run `npm install`, `npm run typecheck`, then the corresponding `npm run` command from its extracted project directory. The ZIP includes the matching local engine build under vendor/ and installs it without waiting for engine publication. Third-party dependencies still require installation. Keep the generated lockfile.

## Source ownership

All implementation lives in `src/`. `src/config.ts` owns fixture settings. The shared `examples/tsconfig.json` enables strict checking against the engine's public declarations. `project/author.ts` builds the document. `cli/run.ts` saves and renders it.

The story, geometry, materials, layer names, and timing are this fixture's inputs. They are not required project defaults. Public API behavior is described by the [online reference](https://codeboard.nonom.xyz/docs/reference/).

## Output and review

Generated files live in this project's `output/`, or the directory selected by `CODEBOARD_EXAMPLE_OUTPUT`. Authoring deliberately regenerates these files. Open saved artwork for revisions; keep independently revised projects out of a generator's output. Render commands read saved state. A generated image or passing assertion still needs visual review.

The author command accepts an output directory as its first argument. No FFmpeg is needed.
