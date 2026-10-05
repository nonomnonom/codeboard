# Lengkap

A fictional six-scene, fifteen-second story with editable brush strokes and synthesized Foley. Its satire is story content, not a claim about real events or a Codeboard principle.

## Local workspace

Install once at the repository root with `npm ci`, then run `npm run build`. The shared `examples` workspace uses the checkout's engine through `file:..`. Keep `npm run dev` running for engine changes and re-run after successful compilation.

```sh
npm run typecheck --workspace @codeboard/examples
npm run lengkap:author --workspace @codeboard/examples
npm run lengkap:render --workspace @codeboard/examples
```

For a downloaded ZIP, run `npm install`, `npm run typecheck`, then the corresponding `npm run` command from its extracted project directory. The ZIP includes the matching local engine build under vendor/ and installs it without waiting for engine publication. Third-party dependencies still require installation. Keep the generated lockfile.

## Source ownership

All implementation lives in `src/`. `src/config.ts` owns fixture settings. The shared `examples/tsconfig.json` enables strict checking against the engine's public declarations. `project/` assembles scenes, `scenes/` draws each scene, `artwork/` owns brushes and marks, `audio/` synthesizes sound, `review/` renders and verifies, and `cli/` exposes commands.

The story, geometry, materials, layer names, and timing are this fixture's inputs. They are not required project defaults. Public API behavior is described by the [online reference](https://codeboard.nonom.xyz/docs/reference/).

## Output and review

Generated files live in this project's `output/`, or the directory selected by `CODEBOARD_EXAMPLE_OUTPUT`. Authoring deliberately regenerates these files. Open saved artwork for revisions; keep independently revised projects out of a generator's output. Render commands read saved state. A generated image or passing assertion still needs visual review.

`npm run lengkap:verify --workspace @codeboard/examples` checks timing and stored artwork, then
performs edit/save/undo experiments in a unique copy under `output/review/`. In a downloaded ZIP,
use `npm run verify`. The source project bytes are checked for changes. Passing these checks
does not approve the story or visual result.

Pass `-- --movie` to the short study/story render command for MP4. FFmpeg is required. Host fonts may differ across platforms. Code is MIT; original synthesized audio is CC0-1.0.
