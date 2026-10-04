# Installation

Run the installer for your operating system. It downloads the latest Codeboard release from GitHub, verifies the archive's SHA-256 checksum, and installs it for your user account. No administrator access, Node.js installation, or npm account is needed.

## macOS and Linux

In Terminal:

```sh
curl -fsSL https://codeboard.nonom.xyz/install.sh | sh
```

Open a new terminal, then check:

```sh
codeboard --version
```

The installer supports macOS on Apple Silicon and Intel, and Linux x64 with glibc. It needs `curl`, `tar`, and either `sha256sum` or `shasum`. Alpine Linux and Linux ARM packages are not available.

Codeboard lives in `~/.local/share/codeboard/versions/`. The command is installed in `~/.local/bin/`. The installer adds that command directory to your bash, zsh, or login profile. To use it immediately in the current terminal:

```sh
export PATH="$HOME/.local/bin:$PATH"
```

## Windows

In a 64-bit PowerShell window:

```powershell
& ([scriptblock]::Create((Invoke-RestMethod https://codeboard.nonom.xyz/install.ps1)))
codeboard --version
```

The installer supports Windows x64. It installs into `%LOCALAPPDATA%\Programs\Codeboard`, adds its `bin` directory to your user PATH, and makes the command available in the current PowerShell session. Windows ARM is not supported.

## Create your first drawing

Choose a working folder for your artwork, separate from the installation folder:

```sh
mkdir my-film
cd my-film
codeboard init
codeboard run scene.mjs
```

Continue with [the quickstart](quickstart.md).

## Review or pin the installer

You can read the [shell installer](https://codeboard.nonom.xyz/install.sh) or [PowerShell installer](https://codeboard.nonom.xyz/install.ps1) before running it. To install a specific release, download the script and pass a version:

```sh
sh install.sh --version 0.2.0
```

```powershell
& .\install.ps1 -Version 0.2.0
```

## Update or uninstall

Run the installer again to select the latest release. Existing version directories are retained; installing a previous version selects it again. Your projects stay in their working folders and are not changed by the installer.

To uninstall, remove the Codeboard installation directory and command wrapper, then remove its PATH entry from your shell profile or Windows user environment settings. Keep any `.cboard` files and authoring scripts you want to retain.

## Optional tools

Movie export requires FFmpeg. Install it separately and put `ffmpeg` on PATH, or supply its path when [exporting a movie](export.md). Drawing, PNG export, and saving projects work without it.

Fonts are read from your system. Install the fonts your artwork uses, or choose fonts available on your machine. macOS may request approval for downloaded executables in Privacy & Security; the portable packages are not notarized.

Prefer manual installation? Download a matching archive from [GitHub Releases](https://github.com/nonomnonom/codeboard/releases/latest), verify it against `SHA256SUMS`, extract it, and add the directory containing `codeboard` or `codeboard.cmd` to PATH. Keep the complete extracted directory together.
