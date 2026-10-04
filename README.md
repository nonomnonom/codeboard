# Codeboard

**Draw with code. Keep the artwork editable. Render the film.**

Codeboard is a JavaScript/TypeScript toolkit for drawing, storyboards, and 2D animation. Your coding agent creates the artwork, renders it for review, and makes targeted revisions through code.

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

[![Six scenes from LENGKAP](docs/media/lengkap-storyboard.png)](https://codeboard.nonom.xyz/examples/)

**LENGKAP** is a 15-second film drawn through the public API. [Watch the examples](https://codeboard.nonom.xyz/examples/) or [read the source](examples/lengkap.ts).

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for building from source and running tests. Report reproducible problems through [GitHub Issues](https://github.com/nonomnonom/codeboard/issues), and security vulnerabilities through [SECURITY.md](SECURITY.md).

Code: [MIT](LICENSE). Original example artwork and audio: CC0-1.0. Dependencies and imported resources have their own licenses; see [NOTICE](NOTICE).
