# Troubleshooting

## The command is not found

Check `node --version` and `npm --version`, then install with `npm install -g codeboard-studio`. On macOS/Linux, npm's global commands are in the `bin` directory under `npm prefix -g`; on Windows they are directly in the global prefix. Ensure that directory is on PATH and open a new terminal. For a project-local installation, use `npx codeboard` from that project. If PowerShell blocks the npm script shim, use `npm.cmd` and `codeboard.cmd`. See [installation](install.md) for migration from the old installer.

## A script cannot import Codeboard

With a global CLI installation, run `codeboard run scene.mjs` instead of `node scene.mjs`. To use plain Node imports, install `codeboard-studio` as a dependency in that project. The runner resolves `codeboard-studio` from the installed runtime. Use `.mjs` for JavaScript. Erasable TypeScript is supported as described in [quickstart](quickstart.md); a project requiring a build tool, JSX, enums, or custom path aliases needs its own compilation step.

## Nothing appears in a render

Check the selected panel and global frame, the layer's `visible`, `opacity`, exposure, and parent groups. A drawing track is blank before its first exposure or when its selected `drawingId` is `null`. A mask with empty alpha hides the masked artwork. A camera can also frame outside the drawing. Render the specific layer without camera placement to separate artwork from framing problems.

## An edit did not persist

Inspection results are copies. Use `layer.set`, `layer.edit`, a selection operation, or `project.production` to apply changes, then save the project. If a save reports a stale version, reopen the current file and reapply your edit. Do not use `overwrite: true` to conceal a conflict.

## Timing looks one frame early or late

Frames start at zero. A 24-frame panel at frame 0 covers 0–23. Range ends are exclusive. Most animation APIs use global timeline frames, including later panels. Pen sample `time` is milliseconds for brush dynamics and is unrelated to timeline frames. Inspect the exposure and keyframe values before changing interpolation.

## A brush imports differently from its original application

Read `missingDependencies`, `unsupported`, and `warnings` in the import report. A tip asset is not an entire brush engine. Render a swatch before using the preset. KPP previews are not fallback tips; unsupported behavior is not silently emulated. See [resource support](brushes.md#external-resource-support).

## Movie export fails

Check that FFmpeg can run, then provide its path with `--ffmpeg` or `FFMPEG_PATH`. Close players holding the output file on Windows. Confirm linked audio exists before saving, or render from a saved project with embedded assets. PNG review does not require FFmpeg.

## The font changes on another machine

Fonts come from the rendering computer. Install the intended fonts there or use a shared available family. The demo's contour artwork does not require a character image, but text appearance still depends on installed fonts.

## Rendering or inspection uses too much memory

Use `ProjectStore.readPanel` for a panel read, `findObjects` with a limit for discovery, and selected panels in a contact sheet. Avoid loading a full document through `toJSON()` just to find a layer. Reduce review thumbnail dimensions rather than changing the artwork. Render sessions can reuse work during repeated evaluation; see [rendering API](api-render.md).

## Report a reproducible problem

Include the Codeboard version, OS, failing command, full error, and a small authoring script or sanitized project that demonstrates the issue. For a visual difference, include the frame number and expected/actual images. Do not include private artwork or credentials unless you intend to share them.
