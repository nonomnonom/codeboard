# Installation

Codeboard is published as [codeboard-studio on npm](https://www.npmjs.com/package/codeboard-studio). One package provides the JavaScript/TypeScript library and the `codeboard` CLI. Install Node.js 22.22 or later and npm first. No npm account is needed to install the public package.

## Install the CLI

On Windows, macOS, or Linux:

```sh
npm install -g codeboard-studio
codeboard --version
```

Rendering uses native dependencies (`skia-canvas` and `sharp`). Installation must allow their install scripts and native downloads. CI checks npm installation on Windows x64, Linux x64, and macOS. FFmpeg is a separate requirement only for movie export.

## Create your first drawing

Choose a working folder for your artwork:

```sh
mkdir my-film
cd my-film
codeboard init
codeboard run scene.mjs
```

Continue with [the quickstart](quickstart.md). The CLI resolves the library for authored scripts, so a global installation does not require a dependency in every artwork folder.

## Install in a project

For a library dependency or a project-specific CLI version:

```sh
npm install --save-exact codeboard-studio
npx codeboard init
npx codeboard run scene.mjs
```

Commit `package.json` and `package-lock.json`; use `npm ci` in CI or on another machine. Use `npx codeboard` in place of `codeboard` throughout these guides when using a local installation. npm scripts can call `codeboard` directly because npm adds the project's binaries to PATH.

JavaScript modules can import the installed library directly:

```js
import { StoryboardProject } from 'codeboard-studio';
```

A global installation alone does not make imports available to plain `node` scripts. Either install locally or run the script through `codeboard run`.

## Pin, update, or uninstall

Select a specific version by adding it to the package name, for example `npm install -g codeboard-studio@0.2.1`.

For a global CLI:

```sh
npm outdated -g codeboard-studio
npm install -g codeboard-studio@latest
npm uninstall -g codeboard-studio
```

For a project dependency:

```sh
npm outdated codeboard-studio
npm install --save-exact codeboard-studio@latest
npm uninstall codeboard-studio
```

Review and commit lockfile changes when updating a project. npm manages updates; Codeboard no longer checks GitHub for releases or provides `codeboard update`. Uninstalling the package leaves artwork in your working folders intact.

## Migrate from the old installer

Install Node.js and the npm package, then remove the old Codeboard command directory from PATH so it cannot shadow npm's command. The old default was `~/.local/bin/codeboard` on macOS/Linux, or `%LOCALAPPDATA%\Programs\Codeboard\bin` on Windows. Use `which -a codeboard` on macOS/Linux or `Get-Command codeboard -All` in PowerShell to inspect which installation runs.

After verifying the npm installation, you may remove the old runtime directory (`~/.local/share/codeboard` or `%LOCALAPPDATA%\Programs\Codeboard`) and its wrapper. For custom installations, use the location you selected. Keep any artwork saved there before removing it. New releases do not provide shell installers, PowerShell installers, or bundled Node archives.

## Connect your coding agent

[Install the Codeboard skills](agent-plugin.md) through your agent host. Plugin/skill discovery follows the host's installation mechanism; npm installs the engine and CLI. Install the npm package in the environment where the agent executes commands, including remote containers or CI runners.

## Optional tools

Movie export requires FFmpeg. Install it separately and put `ffmpeg` on PATH, or supply its path when [exporting a movie](export.md). Drawing, PNG export, and saving projects work without it.

Fonts are read from your system. Install the fonts your artwork uses, or choose fonts available on your machine. See [troubleshooting](troubleshooting.md) for PATH and import problems.
