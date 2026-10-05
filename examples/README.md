# Example workspace

Choose an example, run it, then change one drawing or timing decision. Start with `quickstart` for a first mark, `studio-timing` for an edit with sound, or `agent-revision` for a retryable change to saved work.

Each example's README gives exact commands for its standalone ZIP and for this checkout. Downloaded projects include a matching engine package and their own generated npm/TypeScript configuration.

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

## Keep revisions separate from generated output

An author command creates new example files and refuses to replace an existing project. A render command reads saved state. If you make independent changes to a `.cboard`, keep it outside the generator's output location and reopen it for later revisions.

Source is organized by the work it performs: drawing, scenes, audio, authoring and review. Examples use the public `codeboard-studio` API; see [the contributor guide](../CONTRIBUTING.md#example-scope) when adding one.

## Standalone downloads

After building the engine, `node scripts/package-examples.mjs` packages each example under
`website/public/art/examples/`. Downloads include source, fixtures and the matching engine
tarball under `vendor/`. Packaging generates each download's standalone `package.json` and
`tsconfig.json` from the shared workspace; these are not maintained in individual source folders.
The generated manifest installs the bundled engine without publication; third-party dependencies
still require installation. In a downloaded directory, use `npm run author` or its other listed
action without the repository example prefix. Existing curated movies are snapshots, not proof
that current source has been run or approved.

The [studies workspace](studies/README.md) is the documentation asset generator. `npm run docs:assets -- --video` regenerates its feature images/videos and source downloads. Each run records declared study-to-feature associations and measurements from its generated artifacts. Those associations are not engine test coverage. Explanatory diagrams remain labeled separately from rendered or inspected outputs.

## Lifecycle and module ownership

1. Author through the public `codeboard-studio` package. Keep drawing functions in `artwork/`, `scenes/` or the focused study; use `project/` to assemble and persist them.
2. Save with the framework's default conflict checks. Examples do not use `overwrite: true`. For another generation, select a new output directory with `CODEBOARD_EXAMPLE_OUTPUT` (presentation also accepts `CODEBOARD_DEMO_OUTPUT`). Last Light and Lengkap reserve a new directory before creating audio or brush assets.
3. Reopen the saved project before delivering its preview. Render commands read saved edits and never invoke authoring. Quickstart now has a separate `quickstart:render` workspace command (`npm run render` in its ZIP).
4. Revise an opened project. The agent and studio-timing examples persist the intended plan before committing; retries must match the same commands. `commit` owns schema validation, optimistic concurrency and receipts.
5. Run verification explicitly. Presentation authoring creates work without consuming a previous verification report. `presentation:verify` checks the saved performance and film. Exact scene timings and poses belong to that authored example, not the engine's general contract.

CLI modules parse arguments and call operations. The agent revision lives in `agent-revision/src/project/revise.ts`; Last Light's edit lives in `last-light/src/project/revise.ts`. Lengkap shares one review exporter between author and render. Presentation separates artwork, audio, project assembly and review. Study catalog entries expose `generate` because they author and inspect artifacts; their CLI delegates to `studies/src/project/generate.ts`.

Artwork modules follow the subject they draw. Last Light separates marks, palette, city, rain, lantern, insects and hands; the keeper has dedicated coat, head, arms and legs modules. Lengkap separates palette, drawing primitives, document, person, motor, warehouse and stamp. Their `art.ts` files only re-export the existing drawing entry points. Keep `import type` explicit: example TypeScript uses `verbatimModuleSyntax`, matching the public runner's type-stripping behavior.

Expected results must describe an observable behavior. A saved file's existence or a catalog label alone does not prove a feature works. Study generation decodes the PNG, opens the saved project and verifies its storage; its manifest records dimensions, project identity and version. Before/after sheets are comparisons of named states and are not promised to be identical to one frame of the final saved project. Visual acceptance still requires inspecting the artifacts.
