# Codeboard

**Draw with code. Keep the artwork editable. Render the film.**

Codeboard is a JavaScript/TypeScript toolkit for drawing, storyboards, and 2D animation. Your coding agent creates the artwork, renders it for review, and makes targeted revisions through code.

The [agent plugin](plugin/README.md) gives Codex and Claude Code operation skills for drawing, brushes, storyboards, animation, camera, audio, revision, review, and debugging, grounded in this repository's documentation. Its source lives under `plugin/`.

[Website](https://codeboard.nonom.xyz) · [Documentation](https://codeboard.nonom.xyz/docs/) · [Examples](https://codeboard.nonom.xyz/examples/) · [GitHub Releases](https://github.com/nonomnonom/codeboard/releases/latest)

## Install

macOS or Linux:

```sh
curl -fsSL https://codeboard.nonom.xyz/install.sh | sh
```

Windows, in 64-bit PowerShell:

```powershell
& ([scriptblock]::Create((Invoke-RestMethod https://codeboard.nonom.xyz/install.ps1)))
```

The installer downloads a GitHub release, verifies its checksum, and sets up the `codeboard` command. Node is included; no npm account is required. [Supported systems and installation options](docs/install.md).

## Draw something

Open a new terminal in your working folder:

```sh
codeboard init
codeboard run scene.mjs
```

Open `output/first.png` to see the stroke. `output/first.cboard` keeps the editable project. Change the script and run it again, or [reopen and revise the saved artwork](docs/projects.md).

## Create and revise

- [Draw](docs/drawing.md) with pressure-sensitive paint, vector contours, and pixel surfaces.
- [Make brushes](docs/brushes.md) using your own tips or supported external resources.
- [Animate](docs/animation.md) with drawing substitutions, holds, keyframes, and camera motion.
- [Review](docs/review.md) exact frames, detail crops, sheets, and layer-specific onion skins.
- [Export](docs/export.md) PNGs, storyboard PDFs, and movies with audio. MP4 export requires FFmpeg.

[![Pose drawings from the Codeboard demo](website/public/art/code-board-demo/key-drawings.png)](https://codeboard.nonom.xyz/docs/code-board-demo/)

**The Codeboard demo** follows Clawd through a walk, pause, hop and landing. [Run the example](docs/code-board-demo.md), inspect its onion skins, and revise a drawing hold. Download either the eight-second study or the complete 48-second demo, then run it with the installed `codeboard` CLI. Both use the public API; no engine build is needed. See [all runnable examples](examples/README.md).

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for building from source and running tests. Report reproducible problems through [GitHub Issues](https://github.com/nonomnonom/codeboard/issues), and security vulnerabilities through [SECURITY.md](SECURITY.md).

Code: [MIT](LICENSE). The Last Light and Lengkap original artwork and audio: CC0-1.0. The Clawd demo does not assert ownership of third-party character branding. Dependencies and imported resources have their own licenses; see [NOTICE](NOTICE).
