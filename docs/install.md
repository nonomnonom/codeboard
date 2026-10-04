# Install Codeboard from GitHub

Download a package from [GitHub Releases](https://github.com/nonomnonom/codeboard/releases/latest). Portable packages include Node.js and native drawing dependencies. No Node/npm installation or npm account is needed. Choose the matching OS and CPU; packages cannot be moved between platforms.

| System | Download | Suggested directory | Launcher |
| --- | --- | --- | --- |
| Windows x64 | `codeboard-VERSION-windows-x64.zip` | `%LOCALAPPDATA%\Programs\Codeboard` | `codeboard.cmd` |
| Linux x64 (glibc) | `codeboard-VERSION-linux-x64.tar.gz` | `~/.local/opt/codeboard` | `codeboard` |
| macOS Apple Silicon | `codeboard-VERSION-macos-arm64.tar.gz` | `~/.local/opt/codeboard` | `codeboard` |
| macOS Intel | `codeboard-VERSION-macos-x64.tar.gz` | `~/.local/opt/codeboard` | `codeboard` |

`VERSION` is the release number, for example `0.1.1`. Each archive contains a directory named after the package. Extract it and move that directory to the suggested location. Keep the entire directory together, including `runtime`, `dist` and `node_modules`. Store your artwork outside this installation directory.

## Windows

Extract the ZIP using Explorer, then move/rename the extracted directory to `%LOCALAPPDATA%\Programs\Codeboard`. From PowerShell:

```powershell
& "$env:LOCALAPPDATA\Programs\Codeboard\codeboard.cmd" --version
& "$env:LOCALAPPDATA\Programs\Codeboard\codeboard.cmd" --help
```

To run `codeboard` from any terminal, add `%LOCALAPPDATA%\Programs\Codeboard` to your **user Path** in Environment Variables, then open a new terminal. No administrator installation is required.

## Linux and macOS

Extract your archive and move the contained directory to `~/.local/opt/codeboard`. Example for Linux x64:

```sh
mkdir -p "$HOME/.local/opt"
tar -xzf codeboard-0.1.1-linux-x64.tar.gz
mv codeboard-0.1.1-linux-x64 "$HOME/.local/opt/codeboard"
"$HOME/.local/opt/codeboard/codeboard" --version
```

For macOS substitute `macos-arm64` or `macos-x64` in the archive/directory name. Add the following line to `~/.bashrc` (bash) or `~/.zshrc` (zsh), then open a new terminal:

```sh
export PATH="$HOME/.local/opt/codeboard:$PATH"
```

The launcher resolves its own directory; add that directory to PATH instead of copying or symlinking the launcher alone. Packages are tested on Ubuntu 24.04, Windows Server 2025 and macOS 15 CI runners. Linux requires glibc; Alpine/musl, Windows ARM and Linux ARM are not provided in this release. Packages are not signed/notarized application installers. If macOS blocks an executable downloaded from the Internet, review its origin/checksum and use the system's Privacy & Security approval flow.

## Run and author

```sh
codeboard --help
codeboard validate /path/to/project.cboard
codeboard preview /path/to/project.cboard
codeboard render /path/to/project.cboard --output /path/to/sheets
```

For code authoring, import `dist/src/index.js` from the installation and run your `.mjs` with the bundled `runtime/node` (`runtime\node.exe` on Windows). You can also use a compatible external Node installation. Type declarations are included. For example, put this in your own working directory, adjusting the import to your installation:

```js
import {StoryboardProject, brushes, renderPanelPNG} from '/absolute/path/to/codeboard/dist/src/index.js';
import {writeFile} from 'node:fs/promises';
const project = StoryboardProject.create({title: 'First mark', width: 320, height: 180});
const panel = project.addScene('Scene').addShot('Shot').addPanel();
panel.addRasterLayer('Ink').rasterStroke([
  {x: 40, y: 120, pressure: .2}, {x: 160, y: 40, pressure: 1}, {x: 280, y: 120, pressure: .2},
], brushes.cleanInk);
await project.save('first.cboard');
await writeFile('first.png', await renderPanelPNG(project, panel.id));
```

On Windows use a file URL in the import, such as `file:///C:/Users/NAME/AppData/Local/Programs/Codeboard/dist/src/index.js`. Node runs JavaScript directly; transpile TypeScript or use your own TS runner for `.ts` authoring.

FFmpeg and fonts remain external. Movie export accepts `--ffmpeg /path/to/ffmpeg` or `FFMPEG_PATH`. Still rendering, editing and persistence work without FFmpeg or an Internet connection.

## Verify and update

Compare the downloaded archive's SHA-256 against `SHA256SUMS` in the same release: `Get-FileHash FILE -Algorithm SHA256` on Windows, `sha256sum FILE` on Linux, or `shasum -a 256 FILE` on macOS.

To update, close Codeboard processes, extract the new release into a separate directory, check its version, and replace the old installation directory. Do not overlay different releases' dependencies. Project files stay in your working directory. To uninstall, remove the installation directory and its PATH entry.
