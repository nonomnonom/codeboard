# Example workspace

The examples share one `examples/package.json`, one TypeScript configuration and the repository
lockfile. Each example keeps its own README, `src/config.ts`, source domains and ignored output.
The shared command runner selects the example's working directory and invokes the local engine;
artwork and revision logic remain with their example.

| Project | Purpose |
| --- | --- |
| [quickstart](quickstart/README.md) | One editable stroke and exact-frame PNG |
| [studies](studies/README.md) | Feature studies that generate documentation images, videos, and inspection reports |
| [agent-revision](agent-revision/README.md) | Persisted plan, matching retry, and commit receipt |
| [studio-timing](studio-timing/README.md) | Ten-second shot-local/editorial workflow with saved revision, review and mixed audio export |
| [last-light](last-light/README.md) | Fictional storyboard, audio, and targeted revision |
| [lengkap](lengkap/README.md) | Fictional brush story and verification on a separate copy |
| [code-board-demo](code-board-demo/README.md) | One shared character source for the short study and presentation |

## Work against the local engine

From the repository root:

```sh
npm ci
npm run build
npm run workspaces:check
npm run examples:typecheck
npm run example:quickstart
```

The shared workspace depends on `codeboard-studio` through `file:..`. npm links this checkout
and uses one root lockfile. The website also links the engine. No published version is needed
for local work.

Keep `npm run dev` running in another terminal. It incrementally rebuilds engine JavaScript and declarations in `dist/`; wait for a successful compilation and rerun the example. Existing processes do not hot-reload imports, and artwork is not regenerated automatically. Workspace typechecks consume the built public declarations, without a source alias.

Use a named project command:

```sh
npm run studies:author --workspace @codeboard/examples
npm run last-light:author --workspace @codeboard/examples
npm run last-light:revise --workspace @codeboard/examples
npm run last-light:render --workspace @codeboard/examples
npm run lengkap:verify --workspace @codeboard/examples
npm run code-board-demo:presentation:author --workspace @codeboard/examples
```

A story/study renderer accepts `-- --movie` for optional MP4. The presentation's `presentation:render` command exports its already-saved film. Movie export requires FFmpeg.

Shared commands run with the selected example's directory as their working directory, preserving
its relative input/output paths. Use absolute paths when passing files from another project.

## Structure follows ownership

`src/config.ts` records each fixture's settings and output location. `cli/` parses commands and coordinates work. Larger examples separate `project/`, `scenes/`, `artwork/`, `audio/`, and `review/` where those responsibilities exist. Small examples use fewer modules. The character demo's `character/` is its only pose/geometry implementation; the presentation imports it.

All engine calls use the public `codeboard-studio` API:

| Need | Codeboard pattern |
| --- | --- |
| Initial editable board artwork | `StoryboardProject.create`, hierarchy handles, `transaction` |
| Drawing, holds, placement, camera, audio | Layer handles and `production` operations; board times are global integer frames |
| Find an existing edit target | Explicit IDs or bounded discovery with cardinality checks |
| Revise saved work | `StoryboardProject.open`, targeted operations, version-checked `save` |
| Retry a persisted request | `plan` and `commit`, preserving the same intent and request identity |
| Inspect visual output | Exact frames, crops, sheets, onion skins, or snapshot review exports |
| Independent shot timing/editorial | Dedicated shot-animation/editorial APIs; do not mix their local time with board time |

The story fixtures exercise the board workflow. They are not templates for every shot-animation/editorial project. Use the [capability report and API references](../docs/reference.md) to choose a supported operation; a capability inventory is not a production-quality guarantee.

## Keep evidence separate from assumptions

Stories, characters, brush palettes, geometry, layer names, timing, and fictional captions are fixture inputs. They do not define Codeboard principles, describe real events, or authorize additions to a user's brief. The terminal presentation is scripted, not evidence of autonomous agent execution.

Author commands regenerate designated outputs. To retain independent revisions, open and edit saved state instead of rerunning its generator. Render commands do not re-author. Verification reports name the checks they performed; Lengkap's save/undo experiments run on a copy. A successful typecheck, render, or assertion does not establish visual approval or user acceptance.

## Standalone downloads

After building the engine, `node scripts/package-examples.mjs` packages each example under
`website/public/art/examples/`. Downloads include source, fixtures and the matching engine
tarball under `vendor/`. Packaging generates each download's standalone `package.json` and
`tsconfig.json` from the shared workspace; these are not maintained in individual source folders.
The generated manifest installs the bundled engine without publication; third-party dependencies
still require installation. In a downloaded directory, use `npm run author` or its other listed
action without the repository example prefix. Existing curated movies are snapshots, not proof
that current source has been run or approved.

The [studies workspace](studies/README.md) is the documentation asset generator. `npm run docs:assets -- --video` regenerates its feature images/videos and source downloads. Each run records capability coverage and deliberately separates explanatory diagrams from actual rendered or inspected outputs.
