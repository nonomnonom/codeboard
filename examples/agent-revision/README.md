# Retryable panel revision

A persisted edit plan bound to one explicit panel ID and caption. Matching retries reuse the receipt; changed arguments fail.

## Local workspace

Install once at the repository root with `npm ci`, then run `npm run build`. The shared `examples` workspace uses the checkout's engine through `file:..`. Keep `npm run dev` running for engine changes and re-run after successful compilation.

```sh
npm run typecheck --workspace @codeboard/examples
npm run agent-revision:revise --workspace @codeboard/examples -- /absolute/film.cboard panel-id /absolute/revision.plan.json "Requested caption"
```

For a downloaded ZIP, run `npm install`, `npm run typecheck`, then the corresponding `npm run` command from its extracted project directory. The ZIP includes the matching local engine build under vendor/ and installs it without waiting for engine publication. Third-party dependencies still require installation. Keep the generated lockfile.

## Source ownership

All implementation lives in `src/`. `src/config.ts` owns fixture settings. The shared `examples/tsconfig.json` enables strict checking against the engine's public declarations. `cli/run.ts` accepts a project, panel ID, plan path, and caption. `config.ts` defines the actor. The engine owns plan schema, digest, and saved-version validation.

The story, geometry, materials, layer names, and timing are this fixture's inputs. They are not required project defaults. Public API behavior is described by the [online reference](https://codeboard.nonom.xyz/docs/reference/).

## Output and review

Generated files live in this project's `output/`, or the directory selected by `CODEBOARD_EXAMPLE_OUTPUT`. Authoring deliberately regenerates these files. Open saved artwork for revisions; keep independently revised projects out of a generator's output. Render commands read saved state. A generated image or passing assertion still needs visual review.
