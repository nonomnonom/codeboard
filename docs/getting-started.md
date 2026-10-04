# Getting started

Use Node.js 22.22 or newer. The repository's `.nvmrc` selects the minimum supported version. npm installs the native `skia-canvas` and `sharp` rendering dependencies.

```sh
npm ci
npm run build
npm run example:quickstart
```

The quickstart generates `examples/output/quickstart/first-stroke.png` and `first-stroke.cboard`. It does not need FFmpeg, a browser, API credentials, or a model provider. [Read its complete source](../examples/quickstart.mjs).

## Preview and export

```sh
node dist/src/cli.js validate examples/output/quickstart/first-stroke.cboard
node dist/src/cli.js preview examples/output/quickstart/first-stroke.cboard --port 4173
node dist/src/cli.js render examples/output/quickstart/first-stroke.cboard --output examples/output/quickstart/sheets
```

The preview server stays running until Ctrl+C. It binds to loopback and has no manual drawing editor. Movie export needs a separately installed FFmpeg executable:

```sh
node dist/src/cli.js movie examples/output/quickstart/first-stroke.cboard --output examples/output/quickstart/first-stroke.mp4 --ffmpeg /absolute/path/to/ffmpeg
```

On Windows, use a quoted path to `ffmpeg.exe`. Alternatively, put FFmpeg on PATH or set `FFMPEG_PATH`. The Node SQLite experimental warning on Node 22 is expected; it does not mean the project failed to save.

## Use the library in another project

After building this checkout, run `npm install /absolute/path/to/codeboard` from your consuming project. Use ESM (`.mjs` or `"type": "module"`) and import from `codeboard-studio`. No registry publication is assumed. TypeScript consumers get declarations from the public entry point.

## Common problems

| Symptom | Check |
| --- | --- |
| Native module cannot load | Check Node version, OS and CPU support in the dependency's error. Reinstall on the target machine; do not copy `node_modules` across operating systems. |
| `ffmpeg` not found | Set `FFMPEG_PATH` or pass `--ffmpeg`; still rendering works without it. |
| Memory pressure while rendering | Set `SKIA_CANVAS_THREADS=2`; render a smaller review frame before a full movie. |
| Text differs from the showcase | Install the fonts referenced by the source or revise the font choice. Fonts are not bundled. LENGKAP uses Arial and Segoe Print on Windows. |
| Windows cannot replace a movie | Close any player/browser holding the destination MP4, then export again. The editable project is unaffected. |
| Save rejected as stale | Another writer changed the project. Reopen and reconcile the change rather than forcing an overwrite. |

Authoring programs are trusted local code. Review downloaded scripts before executing them. See [security boundaries](../SECURITY.md).
