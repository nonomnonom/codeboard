# Rendering engine decision

Research date: 2026-10-04.

## libmypaint

`libmypaint` is a mature C brush engine used by MyPaint. Its official repository documents an ISC license, a C API, tiled-surface callbacks, JSON brush settings, and native dependencies including `json-c`; common builds also use GLib and GObject introspection. The current stable release listed by the project is 1.6.1.

It is not a runtime dependency in this release. This Windows workspace has Node.js but no CMake/native build toolchain, and the project does not publish an official maintained JavaScript or WebAssembly package. Adding an unverified community binding would make installation and replay less reliable. A later integration should expose the same public `BrushPreset` and stroke inputs through a native addon or maintained WASM build, then run the existing determinism and export tests against it.

Official sources:

- https://github.com/mypaint/libmypaint
- https://github.com/mypaint/libmypaint/releases
- https://github.com/mypaint/libmypaint/blob/master/brushsettings.json

## Skia and CanvasKit

CanvasKit is Skia's official WebAssembly build for browsers. The official documentation confirms WebGL-backed surfaces, Skia path/paint/text APIs, npm distribution, and bundled TypeScript definitions. CanvasKit objects backed by WASM require explicit deletion. Its npm package uses the BSD-3-Clause license.

CanvasKit is viable for a later interactive in-browser canvas, but it would add a second renderer if used only for review while Node export used another backend. This release instead uses `skia-canvas` 3.0.8, an MIT-licensed Node binding with prebuilt Windows support, for the authoritative renderer. The browser preview displays PNGs produced by that renderer. This keeps preview and export output consistent and proves the Skia integration path in the current environment.

Official sources:

- https://docs.skia.org/docs/user/modules/canvaskit/
- https://skia.org/docs/user/modules/quickstart/
- https://www.npmjs.com/package/canvaskit-wasm
- https://skia-canvas.org/getting-started

## Trade-off

The custom dab engine is deliberately smaller than libmypaint, but it implements real brush behavior rather than renaming line width: spaced dabs, pressure and speed dynamics, radial hardness, flow accumulation, taper, tilt-shaped elliptical dabs, seeded texture grains, and destination-out erasing. It is isolated in `src/render/brush-engine.ts` so replacing it does not change the document, API, preview, or export layers.
