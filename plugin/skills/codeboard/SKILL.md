---
name: codeboard
description: Use when starting Codeboard work, selecting an operation, or when the runtime and documentation source are not yet established. Excludes Storybook UI component work.
---

# Operate Codeboard

Establish one session context, then load the skill for the actual operation. Keep the engine's API reference authoritative.

## Session context

Record the artwork directory, current project, and runtime version. Install the runtime from npm with `npm install -g codeboard-studio`, or use a project dependency and `npx codeboard`. Check `codeboard --version` (or `npx codeboard --version` for a local dependency); an optional source build uses `node <checkout>/dist/src/cli.js`. Run authored scripts through that CLI's `run` command and import from `codeboard-studio`. This works outside the engine directory and avoids platform-specific absolute ESM imports.

The documentation ships with this skill. Open [bundle metadata](references/engine/bundle.json) and [the manual index](references/engine/docs/index.md). The reference root is `references/engine/` beside this SKILL.md; every `docs/` or `examples/` path in these skills is relative to that root, not the user's working directory. No repository checkout or internet is required to read the API guides. Load only relevant pages.

Compare the bundle's engine version with the installed CLI. For a mismatch, check the installed public declarations or obtain matching documentation before using a changed API. Optional online documentation is at https://codeboard.nonom.xyz/docs/. Missing bundled files are a packaging fault; report it instead of guessing calls.

Read `docs/agent-workflow.md` and `docs/cli.md` once. For installation use `docs/install.md`; for a new script use `docs/quickstart.md`. Resolve unfamiliar signatures and return shapes through `docs/reference.md`, the relevant `api-*.md`, and `docs/api-types.md`. If a runtime export needs checking, inspect the public module or installed declaration; a function in an example is not automatically an engine export. Copy bundled examples to the artwork directory before running or adapting them.

Check return shapes as well as method names. `production.inspect()` is an overview, not a document with a top-level `panels` array. Use bounded object queries or `ProjectStore.listPanels()` when panel records are needed.

## Select by the requested change

| Work | Load skill |
| --- | --- |
| Shape, paint, pixels, masks, components | codeboard-draw |
| Brush behavior or imported brush resource | codeboard-brushes |
| Story beats and panel structure | codeboard-storyboard |
| Drawings, placement, holds, joints, timing | codeboard-animate |
| Framing and parallax | codeboard-camera |
| Sound placement and mix | codeboard-audio |
| Changing a saved project | codeboard-revise plus the operation skill |
| Critique, render evidence, export | codeboard-review |
| Failed or unexpected operation | codeboard-debug |

Use the skill name exposed by the host; a host may prefix it with `codeboard:`. Load dependencies by name, not filesystem traversal. Once established, retain this context instead of repeating setup for every operation.

## Execution contract

Work in the user's artwork folder. For a new project, establish one representative image before expanding the sequence. For a saved project, use codeboard-revise. Complete the requested operation with codeboard-review's appropriate evidence; do not force every task through a film-production pipeline.

Before offering an unfamiliar feature, locate its public operation and constraints. If it is unsupported, state the limit and a supported alternative. Keep any alternative distinct from the requested native capability. Report what ran, what was inspected, and what remains unverified.
