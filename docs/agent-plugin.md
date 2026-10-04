# Install Codeboard skills in your agent

Codeboard provides ten portable [Agent Skills](https://agentskills.io/home) for drawing, brushes, storyboards, animation, camera, audio, revision, review, and debugging. They include manuals, API references, and runnable examples that an installed agent can read without this website or the original repository.

Install them as a plugin in Codex or Claude Code, or copy the complete skill folders into another compatible agent's skill directory. The instructions and references are the same in both cases; the marketplace commands are host-specific.

The plugin supplies instructions and references. [Install the Codeboard engine](install.md) separately to run scripts and render artwork.

## Before you start

Use an agent that can discover `SKILL.md` folders, read their supporting files, and execute local commands. It needs access to Codeboard in the same environment where it runs. An image-viewing tool is needed for the agent to inspect rendered artwork; without one, review the images yourself. A chat-only client cannot operate the engine just by receiving these instructions.

In a terminal, verify the engine is available:

```sh
codeboard --version
```

With Git installed, download the skills into a folder separate from your artwork:

```sh
git clone --depth 1 https://github.com/nonomnonom/codeboard.git
cd codeboard
```

Already have the repository? Open its root folder instead. It must contain `plugin/skills/`. No engine build or `npm install` is needed to install the skills.

## Choose your agent

Project directories below are relative to your **artwork project**, not the downloaded Codeboard repository. Each linked host guide documents skill discovery; this table is not a claim of completed Codeboard runtime tests in every host. Locations were checked against host documentation on 5 October 2026.

| Agent | Installation route |
| --- | --- |
| Codex | [Install the plugin](#install-in-codex) with the tested local marketplace commands below. |
| Claude Code | [Install the plugin](#install-in-claude-code) with the commands below. |
| [Cursor](https://cursor.com/docs/skills) | Copy skills into `.cursor/skills/` or `.agents/skills/`. |
| [GitHub Copilot in VS Code](https://code.visualstudio.com/docs/agent-customization/agent-skills) | Copy skills into `.github/skills/` or `.agents/skills/`. |
| [Gemini CLI](https://geminicli.com/docs/cli/skills/) | Copy skills into `.gemini/skills/` or `.agents/skills/`. |
| [OpenCode](https://opencode.ai/docs/skills/) | Copy skills into `.opencode/skills/` or `.agents/skills/`. |
| [Cline](https://docs.cline.bot/customization/skills) | Copy skills into `.cline/skills/`. |
| [Roo Code](https://roocodeinc.github.io/Roo-Code/features/skills/) | Copy skills into `.roo/skills/` or `.agents/skills/`. |
| [Windsurf / Cascade in Devin Desktop](https://docs.devin.ai/desktop/cascade/skills) | Copy skills into `.devin/skills/`; `.windsurf/skills/` remains a documented legacy location. |
| Another Agent Skills host | Use its documented skill directory or folder-import feature and follow the portable installation below. |

## Portable installation for compatible agents

1. Choose one destination from your host's row above, or its own documentation. Create that skills directory in your artwork project.
2. Copy **all ten directories inside `plugin/skills/`** into it, retaining their names and every file beneath them. Keep the core `codeboard` skill: specialists use its shared reference bundle.
3. If Codeboard skills are already installed there, back them up outside the discovery directory before replacing them. Preserve unrelated skills. Avoid installing the same Codeboard set through both a marketplace and copied folders in one host.
4. Reload skills or start a new agent session in the artwork project. Enable skill support if your host requires it, and allow the host to read the skill folders when prompted.

For a host that reads `.agents/skills/`, the resulting layout starts like this:

```text
my-film/
  .agents/skills/
    codeboard/
      SKILL.md
      references/engine/
        bundle.json
        docs/
        examples/
    codeboard-draw/SKILL.md
    codeboard-animate/SKILL.md
    ...the other seven skill folders
```

Do not copy just the Markdown entrypoints or add an extra `plugin/skills/` nesting level. A specialist-only install omits its shared documentation. Hosts with a documented personal skill directory can use that instead of a project directory; use one scope so older copies do not shadow the new version.

### Copy from a terminal

Run from the downloaded Codeboard repository root. Replace the destination with your artwork path and your host's directory from the table. These examples stop if a same-name skill already exists.

macOS / Linux (Bash):

```bash
(
  set -eu
  skills_target="/absolute/path/to/my-film/.agents/skills"
  for skill in plugin/skills/*; do
    if [ -e "$skills_target/${skill##*/}" ] || [ -L "$skills_target/${skill##*/}" ]; then
      echo "Already installed: ${skill##*/}. Back up that folder before replacing it." >&2
      exit 1
    fi
  done
  mkdir -p "$skills_target"
  cp -R plugin/skills/* "$skills_target/"
)
```

Windows (PowerShell):

```powershell
& {
  $ErrorActionPreference = 'Stop'
  $skillsTarget = 'C:\absolute\path\to\my-film\.agents\skills'
  $skillFolders = Get-ChildItem -LiteralPath './plugin/skills' -Directory
  foreach ($skill in $skillFolders) {
    if (Test-Path -LiteralPath (Join-Path $skillsTarget $skill.Name)) {
      throw "Already installed: $($skill.Name). Back up that folder before replacing it."
    }
  }
  New-Item -ItemType Directory -Force -Path $skillsTarget | Out-Null
  foreach ($skill in $skillFolders) {
    Copy-Item -LiteralPath $skill.FullName -Destination $skillsTarget -Recurse
  }
}
```

For remote, container, or cloud agents, put the skills and engine inside that agent's environment. Installing them on your laptop does not automatically make them available to a remote session; use the host's documented project-sync or image setup.

### Verify discovery and references

Open the host's skills list or ask it to list available Codeboard skills. Gemini CLI provides `/skills list` and `/skills reload`; VS Code exposes Configure Skills through `/skills`. In other hosts, use the mechanism in the linked host guide rather than a Claude-specific slash command.

Before an artwork task, ask:

> Load the codeboard skill, show the path to its bundled reference index, read the bundle's engine version, and run codeboard --version. Confirm that you can load codeboard-draw and read the relevant bundled drawing reference. Do not modify any artwork yet.

The reference index must come from the installed core skill's `references/engine/docs/index.md`. Then try one small drawing through [the quickstart](quickstart.md). Discovery alone does not prove that the engine runs or that the agent inspected an image. The [Codeboard demo](code-board-demo.md) is an existing end-to-end result of plugin use: an editable animation project and a 48-second film, with saved-artifact verification. Separate isolated installed-package execution evaluations cover Codex. The additional host installation routes above follow their official documentation; they have not each received an equivalent installation-and-execution evaluation.

## Install in Codex

From the downloaded Codeboard repository root, run these commands in your terminal:

```sh
codex plugin marketplace add ./plugin
codex plugin add codeboard@codeboard-local
codex plugin list --marketplace codeboard-local
```

Confirm that Codeboard appears as installed, then open a new Codex session in your artwork folder. Ask it to use the `codeboard` skill. The agent can select the relevant specialist for the task.

If your Codex installation does not recognize `plugin`, update your Codex client to a version with plugin support, or use its supported skill-folder installation route.

## Install in Claude Code

From the downloaded Codeboard repository root, run these commands in your terminal:

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

For copied skills, back up the installed Codeboard folders outside the host's discovery directories, then replace the full set with the updated `plugin/skills/` contents. Replace the references along with the entrypoints; do not merge only new `SKILL.md` files into old bundles. Keep any personal edits separately and repeat the discovery/version check after reloading.

If the runtime and reference versions differ, have the agent verify the relevant API against matching documentation or the installed declarations before using it. Do not edit the installed reference files to change the version.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Marketplace not found | Run the add command first, from the folder containing `plugin/`, or give it the absolute path to that folder. |
| The checkout has no `plugin/` directory | Use a repository revision that includes the plugin; older engine releases may predate it. |
| Installed but no skill appears | Check the host's installed-plugin list, enabled state and installation scope, then start a new session. |
| Copied skills are not found | Confirm the host's directory and the direct `<skill-name>/SKILL.md` layout. Check skill enablement, folder access, and stale copies in another scope. |
| `codeboard` command not found | Install the engine and reopen your terminal/agent so it picks up PATH changes. |
| Agent asks for the original repo docs | Ask it to load the core `codeboard` skill and its bundled reference. Missing reference files indicate an incomplete plugin installation. |

For an agent without native skill discovery but with file and terminal tools, you can explicitly ask it to read the core `SKILL.md` and the named operation skills from the downloaded folder. This is manual instruction loading, not an installed integration or automatic skill activation. Preserve the whole folder tree so its reference files remain accessible.
