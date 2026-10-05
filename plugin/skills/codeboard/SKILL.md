---
name: codeboard
description: Use when starting Codeboard work, selecting an operation, or when the runtime and documentation source are not yet established. Excludes Storybook UI component work.
---

# Operate Codeboard

Establish session context, then load the operation skill. Keep the API reference authoritative.

## Session context

Record the artwork directory, project and runtime version. Install with `npm install -g codeboard-studio`, or use a project dependency via `npx codeboard`. Check `codeboard --version`. Run scripts through the matching CLI's `run` command and import from `codeboard-studio`; see `docs/start/installation.md` for source-checkout usage.

Prefer `codeboard docs search "English keywords"` or an exact qualified symbol, then `codeboard docs read "returned-id"`. Results carry the installed version and docs hash. Follow `nextLine` using `--from-line` before relying on truncated code or constraints. Empty results do not prove unsupported behavior. See `docs/reference/docs-query.md` for filters and browsing.

For older runtimes without `docs`, open `references/engine/bundle.json` beside this SKILL.md and compare its engine version with the CLI. Every `docs/` path in these skills is relative to that reference root, not the artwork or specialist's directory. Read only relevant pages. If versions differ, obtain matching docs or inspect installed declarations. Missing/corrupt CLI or skill bundles are packaging faults; report them instead of guessing or silently substituting another version.

For installation use `docs/start/installation.md`; for a new script use `docs/start/first-drawing.md`; for commands use `docs/reference/cli.md`. Resolve unfamiliar signatures and return shapes through the relevant page in `docs/reference/api/`, using `docs/reference/api/types.md` to locate data shapes. The installed public exports and declarations define the API. Author for the user's project; demonstration code, IDs, geometry and assets are not framework defaults.

Prefer `production.summary()` and bounded `production.query()` pages over document dumps. A query returns `{version, items, nextCursor?}`; restart after edits or reopening. `production.inspect()` is a larger overview. For query/version checks read `docs/reference/object-queries.md`; for recovery read `docs/reference/errors.md`.

Use `codeboard capabilities` when capability support is uncertain. Add `--probe-dependencies` when a media dependency needs checking; startup inspection does not qualify encoders or output. Older runtimes may lack this command; use matching declarations and docs.

## Select by the requested change

| Work | Load skill |
| --- | --- |
| Shape, paint, pixels, masks, components | codeboard-draw |
| Brush behavior or imported brush resource | codeboard-brushes |
| Story beats and panel structure | codeboard-storyboard |
| Drawings, deformation, controllers, performance, timing | codeboard-animate |
| Framing and parallax | codeboard-camera |
| Sound placement and mix | codeboard-audio |
| Changing a saved project | codeboard-revise plus the operation skill |
| Critique, render evidence, export | codeboard-review |
| Failed or unexpected operation | codeboard-debug |

Use the skill name exposed by the host; a host may prefix it with `codeboard:`. Load dependencies by name, not filesystem traversal. Once established, retain this context instead of repeating setup for every operation.

## Execution contract

Work in the user's artwork folder. For a new project, establish one representative image before expanding the sequence. For a saved project, use codeboard-revise. Complete the requested operation with codeboard-review's appropriate evidence; do not force every task through a film-production pipeline.

Before offering an unfamiliar feature, locate its public operation and constraints. If it is unsupported, state the limit and a supported alternative. Keep any alternative distinct from the requested native capability. Report what ran, what was inspected, and what remains unverified.
