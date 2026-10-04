# Authoring and project workflow

JavaScript/TypeScript tools for code-authored drawing, storyboards, and animatics. The agent operates the drawing and timeline APIs. Humans review rendered work. No AI service, account, or manual editor is required.

Development software, not a claim of feature parity with Storyboard Pro or Harmony. See [capabilities and limits](architecture.md), [storage design and measurements](storage.md), and [brush resources](brush-resources.md).

## Run

Use Node.js 22.22 or newer, `npm ci`, then:

```sh
npm run build
npm test
npm run test:package
npm run example
npm run example:revise -- --movie
```

Movie export needs FFmpeg on PATH or `FFMPEG_PATH`. FFmpeg is not bundled. On memory-constrained machines set `SKIA_CANVAS_THREADS=2`. Node 22 marks its built-in SQLite binding experimental; the tested environment is Windows, Node 22.22, SQLite 3.50.4, and the exact dependency versions in package-lock.json.

[examples/last-light.ts](../examples/last-light.ts) authors the project using the public API, with artwork, custom bitmap tip, and synthesized sound under `examples/last-light/`. It produces `examples/output/last-light/last-light.cboard`, a storyboard PDF, PNG contact sheet and panels. The revision command above retains named before/after revisions inside that same container, extends the base 30-second timing to 30.5 seconds, and refreshes the sheets, manifest and video. Repeating that command refreshes exports without applying another artwork/timing edit. Rerunning the authoring example deliberately replaces its generated head; save independent work elsewhere before regenerating.

[LENGKAP](../examples/lengkap/README.md) is a separate 15-second, six-scene brush-film example retained in the repository. Its commands and outputs are described in its own README.

After building, `.mjs` authoring files inside this checkout can import `codeboard-studio` by name. Outside the checkout, install it from a local path (`npm install /path/to/storybook-pro`) after building that source. No registry publication is needed. `npm run test:package` creates and extracts a local npm archive, then exercises its public entry point through drawing, contour correction, feathered pixel editing, persistence, targeted revision, rendering and CLI startup. This verifier needs `tar` on PATH and reuses installed dependencies without downloading them; it is not a clean-machine install test and does not publish anything. The runtime archive contains the compiled engine, declarations and notices. Full documentation and example authoring sources remain in this checkout.

## Draw and save

```ts
import { StoryboardProject, brushes, catmullRom, renderPanelPNG } from 'codeboard-studio';
import { writeFile } from 'node:fs/promises';

const board = StoryboardProject.create({ title: 'A passing light', width: 1280, height: 720 });
const panel = board.addScene('Street').addShot('Arrival').addPanel({ id: 'arrival', durationFrames: 72 });
board.transaction('Sketch gesture', () => {
  const rough = panel.addRasterLayer('Rough');
  rough.rasterStroke(catmullRom([
    { x: 220, y: 500, pressure: .15, time: 0 },
    { x: 420, y: 220, pressure: .9, time: 300 },
    { x: 720, y: 440, pressure: .25, time: 700 },
  ], 24), brushes.roughPencil, { color: '#202426', seed: 12 });
});
await board.save('arrival.cboard');
await writeFile('arrival.png', await renderPanelPNG(board, panel.id));
```

`.cboard` is a SQLite database containing editable structure and lossless binary payloads, including embedded assets. It is not JSON with another extension. `toJSON()` is an explicit full in-memory materialization, including typed pixel buffers; it is not a JSON-string persistence format. Normal saves never stringify the whole document. [Pixel surfaces](pixels.md) support source-region reads and edits alongside ordered brush replay.

## Inspect and revise without loading the whole artwork

```ts
import { ProjectStore, renderPanelPNG } from 'codeboard-studio';

const store = ProjectStore.open('arrival.cboard');
try {
  console.log(store.inspect());
  console.log(store.findObjects({ panelId: 'arrival', name: 'Rough', limit: 10 }));
  const version = store.version;
  const panel = store.readPanel('arrival');
  panel.layers[0]!.transform.x += 20;
  store.updatePanel(panel, { expectedVersion: version });
  const png = await renderPanelPNG(store.panelDocument('arrival'), 'arrival');
} finally { store.close(); }
```

Targeted storage updates preserve the panel's identity topology and timing. Use the full `StoryboardProject.open()` session for adding/removing objects, changing shots, or retiming, so global relationships are validated together. `production.setPanelDuration` ripples following panels, keyframes, and audio start cues. Pen sample `time` drives brush dynamics; it is independent of animation frames.

Retiming requires a positive safe-integer duration and a recognized mode (`ripple` or `preserve`). It preflights resulting panel ends, mapped frame positions and moved audio-clip ends before applying edits. Overflow fails even when caught inside an enclosing authoring transaction; other edits in that transaction can continue. Interior key positions use an integer ratio rounded to the nearest frame, with ties rounded upward, avoiding off-by-one rounding caused by a large floating-point product. This does not make arbitrarily long movies exportable or change the renderer's resource limits. A `preserve` request that changes duration still rejects the resulting gap/overlap; it does not trim following material.

Pen `time` is in milliseconds, `tiltX`/`tiltY` in degrees (−90 to 90), and `rotation` in radians. The `line`, `cubic`, and `catmullRom` helpers preserve authored time and tilt and interpolate rotation along the shortest angular arc. Omit rotation to let a stylus-oriented tip use tilt direction; explicit zero is an orientation, not a missing value. Curve helpers generate an 8 ms sample cadence when time is omitted. Sparse control-point times interpolate between supplied anchors and continue at the default cadence after the last anchor; decreasing timestamps are rejected. Cubic control values use Bézier interpolation. Raw point arrays should supply timestamps explicitly for deliberate speed dynamics. Rendering clamps elapsed time to at least 1 ms and speed response saturates at 2 canvas units/ms. Changing pen timing changes brush dynamics, not shot duration or write-on animation.

`save()` checks the version originally opened. A stale writer fails instead of overwriting another commit. SQLite transactions recover interrupted writes. `overwrite: true` is reserved for intentional replacement, such as regenerating an example. `ProjectStore.verify()` checks database integrity, every payload checksum, and document relationships. `compact()` removes unreachable payloads and vacuums the container explicitly.

## Render and inspect from the command line

```sh
node dist/src/cli.js inspect project.cboard --panel arrival
node dist/src/cli.js validate project.cboard
node dist/src/cli.js render project.cboard --output sheets
node dist/src/cli.js movie project.cboard --output animatic.mp4
node dist/src/cli.js preview project.cboard --port 4173
```

Preview binds to loopback and is read-only: `/manifest.json`, `/objects?panel=arrival`, `/panel/arrival.png`, `/frame/24.png`, `/contact-sheet.png`, and `/asset/asset-id`. Panel and frame previews use partial artwork reads; a transition frame loads its outgoing and incoming panels. Movie export and contact sheets currently load the full authoring document. The preview intentionally has no drawing toolbar, drag-and-drop editor, or chat interface.

Saved projects export audio from their embedded assets. Unsaved projects or raw document objects must provide an explicit `assetRoot`. JavaScript authoring is trusted local code with normal process permissions, not a sandbox for arbitrary downloaded programs.
