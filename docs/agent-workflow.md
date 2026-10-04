# Work with your coding agent

Your agent writes and executes JavaScript or TypeScript. Codeboard supplies the drawing, inspection, revision, and rendering tools. You review the results and decide what needs to change.

## Set up the agent plugin

[Install the Codeboard skills](agent-plugin.md) in your compatible agent to add operation guidance and the bundled API reference. The guide covers plugin installation in Codex and Claude Code, portable skill folders for Cursor, Copilot, Gemini CLI, OpenCode and other hosts, verification, and updates. Install the [engine](install.md) separately in the agent's execution environment, then open your agent in the artwork folder.

Ask the agent to use the `codeboard` skill for your first task. It establishes the runtime and documentation version and selects the relevant skills for drawing, animation, or revision. The installed reference travels with the plugin, so the agent does not need your source checkout to read it.

## Give the agent a working brief

A useful starting instruction is:

> Use Codeboard to create an editable animation. Work in this folder. Keep the authoring source, assets, and `.cboard` project. Render a contact sheet and selected frames before exporting a movie. Inspect the images, revise the specific shapes or timings that need work, then show me the result. Use stable IDs for parts we may revise later. Ask before replacing existing work.

Add your subject, duration, canvas ratio, style, and intended deliverables. The [character demo](code-board-demo.md) is a concrete source project the agent can read and run.

## Author a small piece first

```sh
codeboard init
codeboard run scene.mjs
```

Have the agent establish one pose, its brush marks, and its layer structure before multiplying it across shots. Confirm the first image at full size. A successful script execution does not establish drawing quality.

## Inspect before editing

```sh
codeboard inspect film.cboard --panel performance --name Clawd --limit 10
codeboard validate film.cboard
```

Inside a revision script, open the saved project and query `project.production.find(...)`. Read the element or layer identified by the result. Use a crop for a hand or contour problem, a frame sheet for timing, and a layer-isolated onion skin for consecutive drawings. Avoid sending an entire `toJSON()` dump to an agent when a bounded query will answer the question.

## Turn feedback into a specific operation

| Feedback | Edit | Review evidence |
| --- | --- | --- |
| “The foot slides” | Adjust the drawing's foot geometry or placement keys during contact | Consecutive frames against a fixed ground line |
| “Hold before the jump” | Extend a drawing range, or ripple-retime the panel if later timing should move | Before/after playback and the exposure list |
| “Move the camera closer” | Update the shot camera's zoom and pan keys | Start, midpoint, and end frame |
| “Only this hand is wrong” | Edit its contour or replace that drawing | Cropped before/after at the same frame |
| “Use a softer pencil” | Test a derived brush, then explicitly edit selected old strokes | Swatch and artwork detail |
| “Delay the sound” | Update the audio clip start frame | Playback around the contact frame |

## Keep or reject a revision

Wrap related synchronous edits in `project.transaction(label, callback)`. Render after the transaction. If the edit is rejected in the same process, call `undo()`; otherwise save it. Use a named [project revision](projects.md) when a checkpoint must survive restarting the agent.

Keep the before/after frame number, affected IDs, and intended timing change in the agent's response. `production.changesSince(version, { limit })` helps identify edits but does not judge their artistic success.

## Resume in another session

Give the next agent the project path, authoring folder, and the latest review request. It should reopen the `.cboard` file rather than regenerate from an outdated script. Source code explains how the artwork was authored; the saved project contains the current edited state.

Scripts run with your local account's permissions. Codeboard has no built-in model, chat service, or agent scheduler. Automatic CLI update prompts are skipped when an agent redirects input or output; use `codeboard update --check` to check explicitly.
