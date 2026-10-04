# Install the agent plugin

The Codeboard plugin gives your coding agent skills for drawing, brushes, storyboards, animation, camera, audio, revision, review, and debugging. It also carries the Codeboard manuals, API reference, and runnable examples, so an installed agent can read them without accessing this website or the original repository.

The plugin supplies instructions and references. [Install the Codeboard engine](install.md) separately to run scripts and render artwork.

## Before you start

You need Git and either Codex CLI with plugin support or Claude Code. In a terminal, verify the engine is available:

```sh
codeboard --version
```

Download the plugin source into a folder separate from your artwork:

```sh
git clone https://github.com/nonomnonom/codeboard.git
cd codeboard
```

Already have the repository? Open its root folder instead. It must contain `plugin/`. No engine build or `npm install` is needed to install the plugin. The commands below register the local marketplace in that folder; run them from the repository root.

## Install in Codex

Run these commands in your terminal:

```sh
codex plugin marketplace add ./plugin
codex plugin add codeboard@codeboard-local
codex plugin list --marketplace codeboard-local
```

Confirm that Codeboard appears as installed, then open a new Codex session in your artwork folder. Ask it to use the `codeboard` skill. The agent can select the relevant specialist for the task.

If your Codex installation does not recognize `plugin`, update your Codex client to a version with plugin support before continuing.

## Install in Claude Code

Run these commands in your terminal:

```sh
claude plugin marketplace add ./plugin
claude plugin install codeboard@codeboard-local --scope user
claude plugin list
```

User scope makes the plugin available to your Claude Code sessions across projects on this machine. Start a new session in your artwork folder. Type `/` and look for the Codeboard skills, such as `/codeboard:codeboard`.

You can also install from an interactive Claude Code session opened at the repository root:

```text
/plugin marketplace add ./plugin
/plugin install codeboard@codeboard-local
```

Complete the installation in the plugin panel and choose the scope you want. Follow the host's reload instruction or start a new session. See [Claude Code's plugin installation guide](https://code.claude.com/docs/en/discover-plugins) for host-specific scopes and troubleshooting.

## Try it in your artwork folder

Give the agent a concrete request:

> Use the Codeboard plugin to create a short editable storyboard in this folder. Start with one representative panel, render and inspect it, then develop the sequence. Keep the source, assets, and `.cboard` project. Use the plugin's bundled reference and check its version against my installed engine.

For an existing project:

> Use Codeboard to extend the anticipation hold in film.cboard by two frames. Inspect the current timing first and explain whether later panels need to move. Preserve the other artwork and show before/after frames.

The plugin includes these skills:

| Skill | Use it for |
| --- | --- |
| `codeboard` | Session setup, runtime/reference checks, and choosing an operation |
| `codeboard-draw` | Shapes, paint, pixels, layers, masks, and components |
| `codeboard-brushes` | Brush authoring, resource import, and swatches |
| `codeboard-storyboard` | Story beats, shots, panels, and captions |
| `codeboard-animate` | Drawings, holds, keyframes, joints, and timing |
| `codeboard-camera` | Framing, camera moves, and parallax |
| `codeboard-audio` | Sound placement, trim, mix, and synchronization |
| `codeboard-revise` | Saved-project edits, checkpoints, and save conflicts |
| `codeboard-review` | Visual inspection, critique, evidence, and export |
| `codeboard-debug` | Runtime, rendering, timing, and storage problems |

Continue with [the agent workflow](agent-workflow.md) for writing a brief, reviewing renders, and resuming work in another session.

## References and updates

Manuals and API pages are included under the core skill's `references/engine/` directory. The bundle records its engine version. Showcase media and external installers remain online links; the API text and included example source can be read offline.

Keep the local repository folder for future plugin updates. Updating the engine with `codeboard update` does not update the plugin. Pull a newer version of the repository, then refresh the installed plugin through your host. For Claude Code, use `claude plugin update codeboard@codeboard-local`. In Codex, rerun `codex plugin add codeboard@codeboard-local` against the updated local marketplace. Start a new session afterward.

If the runtime and reference versions differ, have the agent verify the relevant API against matching documentation or the installed declarations before using it. Do not edit the installed reference files to change the version.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Marketplace not found | Run the add command first, from the folder containing `plugin/`, or give it the absolute path to that folder. |
| The checkout has no `plugin/` directory | Use a repository revision that includes the plugin; older engine releases may predate it. |
| Installed but no skill appears | Check the host's installed-plugin list, enabled state and installation scope, then start a new session. |
| `codeboard` command not found | Install the engine and reopen your terminal/agent so it picks up PATH changes. |
| Agent asks for the original repo docs | Ask it to load the core `codeboard` skill and its bundled reference. Missing reference files indicate an incomplete plugin installation. |

Other agents need their own support for loading Agent Skills and accompanying reference files. These host installation commands are specific to Codex and Claude Code; copying only `SKILL.md` loses the bundled documentation.
