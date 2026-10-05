# Installation

Codeboard is published as [codeboard-studio on npm](https://www.npmjs.com/package/codeboard-studio). One package provides the JavaScript/TypeScript library and the `codeboard` CLI. Install Node.js 22.22 or later and npm first. No npm account is needed to install the public package.

## Install the CLI

```sh
npm install -g codeboard-studio
codeboard --version
```

The npm package supplies both the CLI and library. See [runtime requirements](#runtime-requirements) for native rendering and optional media tools.

## Create your first drawing

Choose a working folder for your artwork:

```sh
mkdir my-film
cd my-film
codeboard init scene.ts
codeboard run scene.ts
```

Continue with [the quickstart](first-drawing.md). The CLI resolves the library for authored scripts, so a global installation does not require a dependency in every artwork folder.

## Install in a project

For a library dependency or a project-specific CLI version:

```sh
npm install --save-exact codeboard-studio
npx codeboard init scene.ts
npx codeboard run scene.ts
```

Commit `package.json` and `package-lock.json`; use `npm ci` in CI or on another machine. Use `npx codeboard` in place of `codeboard` throughout these guides when using a local installation. npm scripts can call `codeboard` directly because npm adds the project's binaries to PATH.

JavaScript modules can import the installed library directly:

```ts
import { StoryboardProject } from 'codeboard-studio';
```

A global installation alone does not make imports available to plain `node` scripts. Either install locally or run the script through `codeboard run`.

## Pin, update, or uninstall

Select a specific version by adding it to the package name, using `npm install -g codeboard-studio@<version>` with the version required by your project.

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

Review and commit lockfile changes when updating a project. npm manages updates. Uninstalling the package leaves artwork in your working folders intact.

## Connect your coding agent

[Install the Codeboard skills](agent-setup.md) through your agent host. Plugin/skill discovery follows the host's installation mechanism; npm installs the engine and CLI. Install the npm package in the environment where the agent executes commands, including remote containers or CI runners.

## Runtime requirements

The same npm package is used across operating systems. Availability depends on the actual runtime and dependencies, not a separate Codeboard installer.

| Operation | Requirements and environment differences |
| --- | --- |
| CLI and authored scripts | Node.js 22.22 or later. Use `codeboard run` for the CLI's library resolution. |
| Drawing and PNG rendering | Native `skia-canvas` and `sharp` dependencies must install for the target OS and architecture. Allow their install scripts and downloads. |
| Editable `.cboard` storage | Node's SQLite runtime and filesystem access. File permissions, locks and link handling depend on the environment. |
| Movie encoding | FFmpeg with the encoder required by the export. Put it on PATH, set `FFMPEG_PATH`, or supply the executable path. |
| Built-in audio decoding | FFmpeg and ffprobe; set `FFPROBE_PATH` if ffprobe is not on PATH. Supported source media depends on their installed build. |
| Text rendering | Fonts available to the renderer. Font availability and rendered pixels can differ between machines. |

Drawing, PNG rendering and saving projects do not require FFmpeg or ffprobe. Check media tool startup with:

```sh
codeboard capabilities --probe-dependencies
```

This reports runtime identity and dependency startup availability. It does not certify installed codecs or guarantee that a particular export will succeed. See [export](../delivery/export.md) and [troubleshooting](../reference/troubleshooting.md) for operation-specific requirements.
