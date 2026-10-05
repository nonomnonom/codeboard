# Export

## Choose the output

| Need | Output | Command or API | Requirement |
| --- | --- | --- | --- |
| Continue editing | `.cboard` | `project.save(...)` | Preserve source and fonts separately |
| Review an exact moment | PNG | `renderFramePNG(project, frame)` | A frame inside the timeline |
| Share panels and captions | PDF and images | `codeboard render` | Panel captions |
| Send frames to another workflow | Images and manifest | `codeboard animatic` | Disk space for the sequence |
| Review motion and mixed audio | MP4 | `codeboard movie` | FFmpeg |

For project-local installations, prefix CLI commands with `npx`. API snippets assume an in-memory project; reopen one with `StoryboardProject.open('film.cboard')` when exporting saved artwork. Create destination directories before using `writeFile` directly.

Export images for review, paginated storyboard sheets for sharing, or a movie for timing and sound review.

## PNG frames

```ts
import { renderPanelPNG, renderFramePNG } from 'codeboard-studio';
import { writeFile } from 'node:fs/promises';

await writeFile('panel.png', await renderPanelPNG(project, 'notice'));
await writeFile('frame-24.png', await renderFramePNG(project, 24));
```

Use a panel render to review a panel and a frame render for a specific timeline moment. [Review tools](review.md) also provide crops, contact sheets, frame sheets, and onion skins.

## Storyboard sheets

```sh
codeboard render film.cboard --output sheets --columns 2 --rows 2
```

The export includes panel images and a paginated PDF. Layout handles the page grid and captions independently of artwork composition. Panel action, dialogue, camera notes, and titles provide caption content.

Through code:

```ts
import { exportStoryboard } from 'codeboard-studio';
const result = await exportStoryboard(project, 'sheets', {
  columns: 2, rows: 2, margin: 36, gutter: 18, captionHeight: 96,
});
console.log(result.pdfFile);
```

## Movie with audio

Install FFmpeg, then run:

```sh
codeboard movie film.cboard --output film.mp4
```

To choose an FFmpeg executable explicitly:

```sh
codeboard movie film.cboard --output film.mp4 --ffmpeg /path/to/ffmpeg
```

On Windows use a quoted path to `ffmpeg.exe`. You can also set `FFMPEG_PATH` in your environment. Export evaluates artwork, drawing substitutions, camera, transitions, and audio from the saved project.

```ts
import { exportMovie } from 'codeboard-studio';
await exportMovie(project, 'film.mp4', {
  onProgress: (frame, total) => console.log(frame, total),
});
```

Save the project before movie export to include its embedded assets. If exporting an unsaved project with linked assets, provide the correct `assetRoot`.

## Animatic package

```sh
codeboard animatic film.cboard --output animatic
```

This exports frame images and a manifest for an external review or playback workflow. It is separate from the encoded MP4.

## Repeated frame rendering

```ts
import { createRenderSession } from 'codeboard-studio';
const session = createRenderSession(project, 64 * 1024 * 1024);
for (const frame of [0, 24, 48]) {
  const canvas = session.frame(frame);
  try { await writeFile(`frame-${frame}.png`, await canvas.toBuffer('png')); }
  finally { canvas.getContext('2d').reset(); }
}
```

A session freezes a validated snapshot and reuses a bounded artwork cache. Create a new session after edits; an old session intentionally keeps the old artwork. `session.panel(id, frame?)` renders one panel and `session.durationFrames` reports its timeline length. The cache limit is in bytes, not a reduction in artwork quality.

Canvas-returning APIs leave the canvas to the caller; release its drawing state when finished. PNG-returning APIs handle their temporary canvases. Use exact-frame renders to compare preview and export. Differences in installed fonts, native library versions, or FFmpeg settings can still affect cross-machine results.

## Before delivery

Check the first and last frame of each shot, transitions, the full playback, and audio sync. Keep the `.cboard` file and source scripts with your exports so future feedback can be addressed through code.

## Shot and editorial movies

`exportShotMovie(animation, output, options)` and `exportEditorialMovie(sequence, animations, output, options)` export H.264 MP4 from isolated studio snapshots. They use the same FFmpeg process and temporary-output pipeline as board movies. Options include `ffmpegPath`, `maxFrames` (default 100000), `signal` and `onProgress`. Studio audio uses an explicit mix/omission policy; board tracks are not attached to a different timeline.

Set `fontPolicy: 'require-available'` on `exportMovie`, `exportShotMovie` or `exportEditorialMovie` to reject unavailable text families before audio extraction/decoding and picture rendering. Board export checks board panels; shot export checks that shot; editorial export checks its referenced shots, including hidden text. Failure creates no destination movie. The default `allow-fallback` retains backend font substitution. This is the same [bounded availability check](#persistent-png-frame-jobs) used by frame jobs, with the same generic-family and glyph/binary-identity limits. `exportFrameJobMovie` also accepts this optional policy to check source text, although its PNGs are already rendered; availability checking is not required merely to encode stored PNGs.

Pass `range: {startFrame: 48, endFrame: 96}` to export the half-open interval `[48, 96)` in the selected shot/editorial frame rate. Bounds must be nonnegative safe integers, nonempty and within that timeline. `maxFrames` applies to the selected frame count, and progress starts at zero for that output. Results include the original `range`. Frame evaluation keeps the original source positions, including active transitions and preroll keys; no source keys or clip ranges are rewritten.

Mixed audio uses the same window, with both absolute endpoints rounded to the nearest 48 kHz sample. At fractional frame rates this can differ by one sample from separately rounding the selected duration; the result reports the exact sample range. Authored fades and transition ramps retain their original phase. Clips outside the window are not decoded; intersecting clips are still decoded in full and remain subject to `maxSamples`. Dimensions and editorial validity are checked for all used sources, even for a partial export. Frame ranges are not persisted jobs, resumable checkpoints or a guarantee that separately encoded AAC chunks concatenate seamlessly.

CLI equivalent: `codeboard movie film.cboard --editorial edit:main --start-frame 48 --end-frame 96 --omit-audio --output excerpt.mp4`. Supply both bounds; these flags require `--shot` or `--editorial`. Use `--mix-audio linear` to include studio audio.

```js
await exportEditorialMovie(
  project.editorialSequence('edit:main'),
  project.studio.animations,
  'editorial-picture.mp4',
  { maxFrames: 10000 },
);
```

CLI equivalents are `codeboard movie film.cboard --output shot.mp4 --shot animation:greeting` and `codeboard movie film.cboard --output picture.mp4 --editorial edit:main`. The selectors are mutually exclusive; omit both for the existing board movie with its board audio.

Studio movie sources must share even canvas dimensions, including sources separated by cuts. The image input uses an explicit rational frame rate, and the encoder receives the exact requested video frame count. A fractional frame rate is not rounded to an integer. Progress reports frames handed to the encoder, not completed playback validation. The output is published after FFmpeg closes successfully. Cancellation/failure terminates the child and removes its generated temporary file; cleanup errors are reported. A successful export still needs codec/frame-count/playback inspection before production delivery. This is not a persisted or resumable render job.

If a studio target has unmuted audio clips, picture-only movie export now requires `{ audio: 'omit' }` (CLI `--omit-audio`). Alternatively select the mix policy below; without either policy it rejects. Editorial export checks both its own tracks and referenced animations.

### Mix studio audio into MP4

```js
const decoder = createFFmpegAudioDecoder(project.captureAssetReader());
const movie = await exportEditorialMovie(
  project.editorialSequence('edit:main'), project.studio.animations,
  'film.mp4', {
    audio: { mode: 'mix', decoder, transitions: 'linear' },
  },
);
```

The same policy works with `exportShotMovie`; its transition choice has no effect without editorial overlaps. The decoder can be the built-in FFmpeg adapter or another implementation of `StudioAudioDecoder`. `maxSamples` inside the audio policy may lower the mixer's 16777216-sample-per-channel ceiling (about 349 seconds at the fixed 48 kHz movie mix rate). The mix uses source-shot and sequence tracks, trims/conforms them, and writes stereo float PCM to a private temporary directory before AAC encoding at 192 kbit/s. It does not quantize through PCM16. Decoder FFmpeg/ffprobe paths are configured on the decoder; movie encoder `ffmpegPath` is independent.

Any sample above full scale rejects before video encoding. Adjust authored gains and review the mix; there is no automatic limiter or normalization. Results include `audio.mode` (`mixed` or `omitted`), and mixed results report sample rate/count, peak and clipping count. A silent authored mix still creates a silent audio stream. Codec delay, AAC true peak and A/V playback synchronization require delivery verification; zero PCM clipping does not prove codec output cannot overshoot.

CLI: `codeboard movie film.cboard --output film.mp4 --editorial edit:main --mix-audio linear`. Choose `sum` to retain overlapping audio gains, or `--omit-audio` for picture only. These policies are mutually exclusive. `--ffprobe <path>` is available with mixing; `--ffmpeg` configures both CLI decoding and encoding. Temporary audio files are removed on success/failure; a cleanup failure is reported even if the movie was already published. There is no resumable render queue or retained mix master.

Animatic packages accept `maxFrames` (default 100000); CLI: `codeboard animatic film.cboard --output animatic --max-frames 2400`. The limit must be a positive safe integer. The document, frame count and raw-document audio-root requirement are checked before output directories are created. Empty frame sequences remain allowed; movie containers require at least one frame. The options object is captured before asynchronous work, so later caller changes do not switch asset roots during export. The output directory must be new (even an existing empty directory is rejected). Parent directories are created as needed. Results use absolute paths. Ordinary media, encoding, cancellation or filesystem failures remove only the directory created for this export; cleanup failure is reported together with the original failure. Existing output directories are never cleaned or replaced.

`exportAnimaticPackage` also accepts `signal: AbortSignal`. Cancellation is checked before work, between assets/frames and before manifest publication. Each frame canvas is released after encoding. The exporter writes a temporary manifest and renames it to `animatic.json` only after completing all assets and PNGs; consumers should require this manifest before accepting a package. Abrupt process death can leave a directory without that completion marker. Retry into a new directory; this API does not resume partial output or guarantee power-loss durability. A process can finish publishing just before a cancellation arrives; completion then wins.

## Persistent PNG frame jobs

For text dependency checks, set `fontPolicy: 'require-available'` in `createFrameJob` options. Creation and every `runFrameJob` call inspect all text in referenced shots, including hidden drawings. A missing explicitly named family anywhere in a fallback list, invalid shorthand, or unsupported shorthand rejects with `MISSING_DEPENDENCY` before rendering. Existing jobs and the default `allow-fallback` policy retain backend fallback behavior.

`inspectShotFonts(animation)` and `inspectProjectFonts(project)` return a bounded report with owner/layer/element IDs, requested families and actual families used by the backend for the element's text. Project inspection also includes board panels and component sources. Unquoted `serif`, `sans-serif`, `monospace`, `cursive`, `fantasy` and `system-ui` are system mappings; they do not pin a particular font. Quoted names are checked as explicit family names. CSS escapes in family declarations are reported as unsupported rather than guessed. Reports are limited to 4096 text elements, 1 MiB total text and 256 KiB serialized output; narrow the inspection to a shot if needed.

Load custom fonts through the installed `skia-canvas` `FontLibrary.use` before inspection or running a job. Its registry is process-wide; keep it unchanged during a render. Availability checks do not embed fonts, hash font binaries, guarantee individual weights or glyph coverage, or ensure cross-machine pixel parity. Resolved fallback families remain visible in the report. See the [font preflight study](visual-examples.md#check-fonts-before-rendering).

For frame jobs, `fontFiles` can pin explicit font files instead of relying on prior registration:

```ts
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const fontFiles = [{
  family: 'Title Face',
  path: 'fonts/title.woff2',
  sha256: createHash('sha256').update(readFileSync('fonts/title.woff2')).digest('hex'),
}];
```

Pass this array as `fontFiles` in `createFrameJob` options. The text must name that family.
Paths use forward slashes and resolve relative to the saved
source project's directory, including when resumed with `sourcePath`. Absolute paths, parent
traversal and symlinks escaping that directory are rejected. Keep the font files and their
licenses alongside the source when moving it. Pass the same `fontFiles` to `publishProject`
to include verified font copies; the returned manifest contains their new relative paths for
subsequent frame jobs. The manifest accepts up to 64 files, with 32 MiB per file and
128 MiB total limits.

Creation and resume verify every declared SHA-256 before loading any font. Verified bytes are
loaded through temporary private copies under content-derived aliases. Only the private render
document is rewritten; saved family names and project bytes remain unchanged. Missing files
raise `ASSET_MISSING`; changed bytes raise `ASSET_CHECKSUM_MISMATCH`. Registry resets during
rendering stop the job before the next frame commit. Use an immutable font registry for the
worker lifetime. Undeclared families, glyph fallback, OS font behavior and other environment
differences remain outside this pinning guarantee. `fontPolicy: 'require-available'` still
performs its separate availability check.

Encoding stored job PNGs does not need these font files unless the caller explicitly requests
strict font preflight on the movie export. Font declarations do not embed font data in the job.

Use a separate SQLite job file to retain completed shot/editorial PNGs across calls. The job references a saved `.cboard` file: it does not embed the project. Keep that source unchanged, or first make a version-pinned copy with `migrateProject`.

```ts
import { writeFile } from 'node:fs/promises';
import {
  createFrameJob, runFrameJob, inspectFrameJob, readFrameJobFrame,
} from 'codeboard-studio';

createFrameJob('film.cboard', 'picture.cjob', {
  expectedVersion: 12,
  target: { kind: 'shot', animationId: 'animation:greeting' },
  range: { startFrame: 0, endFrame: 48 },
  maxBytes: 512 * 1024 * 1024,
});
await runFrameJob('picture.cjob', {
  onProgress: (completed, total) => console.log({ completed, total }),
});
console.log(inspectFrameJob('picture.cjob'));
await writeFile('frame-0000.png', readFrameJobFrame('picture.cjob', 0), { flag: 'wx' });
```

For editorial output select `{kind: 'editorial', sequenceId: 'edit:main'}`. Creation requires a new destination and the exact saved version. Frame ranges are half-open, absolute timeline positions, nonempty and limited to 100000 frames. The default stored PNG budget is 512 MiB, configurable up to 1 GiB; each PNG is capped at 128 MiB. This budget excludes SQLite overhead, journal files and temporary renderer memory.

Retry `runFrameJob` against the existing job. It validates source ID/version/document hash and renderer identity, verifies each visited stored frame's SHA-256, and renders missing frames. Each PNG and checksum commit together. An ordinary error, callback failure or cancellation leaves earlier commits available. Pass `signal` for cancellation. `sourcePath` can relocate the source only when its captured identity and document content match.

After abrupt worker termination, a pending SQLite rollback journal can require write access
before the job can be read. Read-only inspection then reports `OPERATION_FAILED` with
`details.reason: 'FRAME_JOB_RECOVERY_REQUIRED'`. Resume through `runFrameJob` with the matching
source and a writable job file; SQLite rolls back the unfinished transaction before frames
are verified and resumed. Keep the job and its journal together; do not delete the journal.
Inspection does not perform this write recovery itself. This follows SQLite's
[hot-journal recovery requirement](https://www.sqlite.org/rescode.html#readonly_rollback).

Worker `range` must fit inside the job range. Separate processes can request disjoint ranges; overlapping workers may render the same frame, accepting identical bytes and rejecting differing results. Database contention can fail after the five-second busy timeout and requires a retry. There is no scheduler, lease or automatic retry loop. Progress callbacks describe the selected worker range; returned counts describe the whole job. `inspectFrameJob().complete` counts stored rows, not verified image integrity. Resume verifies visited rows; `readFrameJobFrame` verifies its selected row.

Renderer identity includes package version, Node/platform, CPU architecture, the installed Skia Canvas package version, Sharp's reported dependency versions (including libvips and LittleCMS), and a hash of the engine's on-disk JavaScript/TypeScript files. Source and built installations therefore differ, and even unrelated engine edits can invalidate a job. Keep the installation immutable throughout a process lifetime. Backend version differences reject resume before new frames are written. Older manifests without backend metadata remain readable but do not match the current renderer for resume; use their original installation or create a new job. Identity also hashes loaded Skia/Sharp native addons and libvips shared libraries reported by Node, using filenames and SHA-256 rather than absolute installation paths. A different hash rejects resume even when reported versions match. Missing historical binary metadata also prevents a runtime match. The map covers only the named files: it does not pin fonts, OS libraries, every transitive library, WASM payloads or runtime settings such as GPU selection. Keep native files unchanged for the process lifetime; the hashes describe their on-disk bytes, not a dump of mapped executable memory. Checksums detect byte changes, not visual correctness or authenticity. Jobs store picture PNGs; exportFrameJobMovie assembles them with an explicit studio audio policy. Crash recovery, concurrent workers and image equivalence still require runtime qualification; static checks alone do not establish production readiness.

### Render selected shot layers as a pass

```ts
const pass = { layerIds: ['layer:character'], background: 'transparent' } as const;
const png = await renderShotFramePNG(animation, 12, pass);
const session = createShotRenderSession(animation, pass);

createFrameJob('film.cboard', 'character.cjob', {
  expectedVersion: 12,
  target: { kind: 'shot', animationId: animation.id, render: pass },
});
```

`ShotRenderOptions` accepts an optional nonempty list of at most 256 unique layer IDs and
`background: 'scene' | 'transparent'`. Omitted options preserve full-shot rendering and its
authored background. Selecting a group includes its subtree; selecting a descendant retains
its ancestor transforms, opacity, masks and effects. Hidden layers and drawing holds retain
their authored visibility. The shared compositor evaluates required masks and clipping alpha
even when their artwork is not selected. Invalid IDs/options reject during session creation,
before frame-job creation writes a file. Options and artwork are captured by the session.

Selection controls picture inclusion; the complete shot still supplies controllers, joints,
mesh bindings and dependency validation. This is not dependency pruning or a geometry-only
render. Selected layers keep their blend modes, so combining isolated passes externally is not
guaranteed to reproduce a full render when blends/effects depend on omitted siblings. Alpha is
ordinary filtered artwork coverage, not an object-ID, depth or ungraded material AOV.

The job manifest retains its shot `target.render` options for every worker/retry. Use separate
job files for different passes from the same saved source. Editorial targets do not accept shot
render options. A transparent pass requires an explicit flatten output profile before H.264
delivery; PNG jobs retain alpha. Audio selection remains a separate movie policy and is not
filtered by selected picture layers. The frame-jobs consumer writes `prop-pass.png` and a
separate pass job; this path still requires runtime alpha/mask/mesh and resume qualification.

### Separate master and review profiles

Create separate jobs against the same saved version to retain a native-size master and a
smaller review. Add `outputProfile` to the review job options:

```ts
outputProfile: {
  width: 1280, height: 720, fit: 'contain', alpha: 'flatten',
  background: { r: 24, g: 24, b: 24 },
}
```

Profiles are stored in the immutable job definition and reapplied to missing frames on resume.
Dimensions must be positive integers within the 32-megapixel surface budget. `contain` adds
centered padding, `cover` crops centrally, and `fill` stretches to the requested dimensions.
RGB background channels are integers from 0 through 255. `alpha: 'preserve'` keeps transparency
and uses transparent padding; it does not accept a background. `flatten` composites against
the explicit opaque background, including padding. Resampling uses Sharp's Lanczos3 kernel
on the renderer's encoded 8-bit PNG. This neither rerenders at a higher resolution nor adds
linear-light compositing, ICC output transforms, HDR or higher-bit-depth masters.

Omitting the profile keeps the original PNG bytes and dimensions. Existing profile-free jobs
retain their behavior; older strict readers reject manifests containing the new field. Each job
renders independently and has its own storage budget. The frame-jobs study includes a second
review job from the same source; profile rendering and codec interoperability still need runtime
qualification. Profiles are currently configured through the TypeScript API.

### Encode a completed frame job

`exportFrameJobMovie(jobPath, output, options)` reads PNGs from a completed job without rendering them again. It requires the matching saved source for dimensions, timing and audio. Options use the studio movie `audio` policy (`'omit'` or `{mode: 'mix', decoder, transitions}`), plus `sourcePath`, `ffmpegPath`, `maxFrames`, `signal` and `onProgress`. The entire job range is exported; no second range is accepted.

For profiled jobs, H.264 requires `alpha: 'flatten'` and even output dimensions; it rejects
`preserve` rather than silently dropping the requested alpha. Source canvases may have odd
dimensions when a profile supplies even output dimensions. Editorial sources must still share
their source dimensions. Profile-free jobs keep the existing source-dimension checks and movie
behavior. Timing and audio always come from the original pinned source and range.

```ts
import { exportFrameJobMovie } from 'codeboard-studio';
await exportFrameJobMovie('picture.cjob', 'picture.mp4', { audio: 'omit' });
```

Authored unmuted audio requires explicit mixing or omission. Mixing uses the existing studio mixer and the original job range rounded to 48 kHz endpoints. API callers supply the decoder and remain responsible for its media snapshot; CLI mixing captures the saved project's asset reader. The export shares normal H.264/AAC encoding, dimension checks and clipping rejection. It reserves a new destination exclusively; existing files reject. Ordinary failure removes that reservation and the encoder's temporary output. An abrupt kill may leave reserved/temporary files requiring inspection and cleanup before retry.

The job is held in a SQLite read transaction during mixing and encoding, and each frame checksum is verified before piping it to FFmpeg. This keeps one database snapshot but can delay writers in rollback-journal mode; export completed jobs after workers finish. No renderer identity comparison is needed to read existing PNGs: their bytes are preserved, while audio is mixed using the current implementation and decoder. The saved source ID/version/document hash must still match. Successful encoding reports the job path, captured source, original range and audio result.

### Deliver a stored PNG sequence

```ts
import { exportFrameJobSequence } from 'codeboard-studio';
const result = await exportFrameJobSequence('character.cjob', 'delivery/character', {
  maxFrames: 100000,
  onProgress: (completed, total) => console.log({ completed, total }),
});
```

The job must be complete, and the output directory must not exist. This API copies stored
PNG bytes without rerendering, resizing or dropping alpha. It does not require the original
project, renderer or fonts. All frame hashes are checked under one SQLite read snapshot.
The directory contains:

- `frames/000000.png`, `frames/000001.png`, …, numbered from zero for import into compositors.
- `frames.jsonl`: one JSON record per frame with absolute source `frame`, relative `file`,
  byte count and SHA-256. The records are streamed rather than accumulated in memory.
- `sequence.json`: completion marker, format `codeboard-frame-sequence/1`, complete source job
  manifest, frame count/pattern, total PNG bytes and the checksum-file byte count/SHA-256.

Timing, source range, selected-layer settings, output profile and renderer provenance remain
in `sequence.json.source`. Package numbering is relative to that range; the checksum records
retain original shot/editorial frame numbers. Configure the external compositor's frame rate
from `source.frameRate.numerator / source.frameRate.denominator`. This is picture-only delivery;
export audio stems separately. The return value contains paths/counts rather than a large
per-frame listing.

`signal` supports cancellation between frames and before completion publication. Callback,
checksum, write and ordinary cancellation failures remove only the newly created output
directory; cleanup errors retain the original failure. Parent directories may remain.
Abrupt termination can leave an incomplete directory: require `sequence.json`, then verify
the checksum file and each PNG before accepting delivery. The exporter does not decode or
read back written PNGs, fsync for power-loss durability, authenticate the manifest or resume
an interrupted copy. Retry into a fresh directory. The read transaction can delay job writers;
publish after rendering is finished. External application/alpha round-trip qualification
remains required. The frame-jobs study exports its prop pass through this API.

### Verify a delivered frame sequence

```ts
import { verifyFrameSequence } from 'codeboard-studio';
const verified = await verifyFrameSequence('delivery/character', {
  decode: true,
  signal: controller.signal,
  onProgress: (count, total) => console.log({ count, total }),
});
```

Verification checks the completion manifest, its source range/count/byte budget, checksum-list
size and SHA-256, sequential filenames/source positions, and every listed frame's size/hash.
It requires no project or original engine renderer and never opens paths declared in source
provenance. The manifest is limited to 1 MiB, records to 1 KiB each, the checksum list to
32 MiB, and each PNG to 128 MiB; source job limits still cap 100000 frames and 1 GiB of PNGs.
Files stream in bounded chunks. `signal` is checked during reads; progress counts verified PNGs.

Entries must be regular files under the canonical package directory. Linked files/directories,
path traversal, duplicate/reordered records, missing frames and trailing partial records reject.
Extra unlisted files are ignored. Keep the package unchanged during verification: this is a
filesystem read, not an atomic snapshot or protection against a hostile concurrent writer.
Success returns the manifest and verified count/bytes. By default verification checks bytes only.
With `decode: true`, it also decodes each frame through installed Sharp with strict decoder
failure handling and a 32-megapixel input limit. This mode accepts single-frame PNGs with
8-bit channels, matching current engine output. Frames must match output-profile dimensions;
without a profile, the first decoded frame establishes the dimensions for the whole sequence.
Flatten profiles require all decoded alpha bytes to be 255. A preserve profile may legitimately
contain entirely opaque artwork and does not require transparent pixels.

Decoded results include `images.width`, `height`, `decoded`, `transparentFrames` and
`opaqueFrames`. Transparent means at least one decoded alpha byte is below 255. The decoder
holds one encoded frame and one RGBA8 surface at a time (plus backend overhead); byte-only mode
keeps streaming chunks. Cancellation is checked around native decode, not inside it. This
checks decodability, dimensions and alpha coverage, not visual intent, correct color transforms,
premultiplication artifacts or independent compositor interoperability. Neither mode authenticates
a sender or promises files remain unchanged. The frame-job study requests decoding after prop
sequence export.

### Verify stored job integrity

`await verifyFrameJob('picture.cjob', {signal, onProgress})` verifies every present frame's SHA-256 under one SQLite read snapshot. It needs neither the saved source nor the original renderer. Results include the manifest, `verified`, `missing`, `bytes` and `complete`. Incomplete jobs can pass integrity verification with `missing > 0`; missing frames are reported rather than treated as corruption. A checksum mismatch or inconsistent record count rejects. Progress counts visited positions in the whole job range, including missing positions.

The verifier reads one bounded PNG at a time and yields between positions for cancellation. It performs no writes and does not decode images, authenticate a sender or certify visual correctness. Its result describes that snapshot, not future writes. The read transaction may delay writers; run verification after workers finish when possible. `inspectFrameJob` remains the cheaper metadata/count query. Manifest JSON is capped at 64 KiB on both creation and reading, with limits measured in UTF-8 bytes; SQL suppresses oversized manifest/frame payloads before transferring them to JavaScript.

Executable lookup failures in movie encoding or the FFmpeg audio decoder use the structured `MISSING_DEPENDENCY` error, naming FFmpeg/ffprobe and the selected executable. Movie encoding waits for successful process startup before requesting PNGs. This does not preflight codecs or skip source/audio preparation; permission, codec and media errors retain their own failure paths. See [dependency handling](agent-workflow.md#missing-media-executables).

### Composite shot passes with a typed graph

`ShotRenderOptions.compositing` accepts a `ShotCompositeGraph` for
`createShotRenderSession`, `renderShotFramePNG` and a shot frame job's `target.render`.
It overrides the shot's stored `ShotAnimation.compositing` graph for that render. An explicit
override is pinned in the job manifest; an inherited graph is pinned through the saved source
document hash. The render options themselves do not mutate the project.

```ts
import { renderShotFramePNG, type ShotCompositeGraph } from 'codeboard-studio';

const compositing: ShotCompositeGraph = {
  nodes: [
    { id: 'set', kind: 'source', layerIds: ['layer:set'] },
    { id: 'actor', kind: 'source', layerIds: ['layer:actor'] },
    { id: 'grade', kind: 'effects', input: 'actor', effects: [
      { kind: 'saturation', amount: 0.8 },
      { kind: 'brightness', amount: 1.1 },
    ] },
    { id: 'picture', kind: 'blend', background: 'set', foreground: 'grade',
      mode: 'source-over', opacity: 1 },
  ],
  output: 'picture',
};
const png = await renderShotFramePNG(animation, 12, { compositing });
createFrameJob('film.cboard', 'composite.sqlite', {
  expectedVersion: project.version,
  target: { kind: 'shot', animationId: animation.id, render: { compositing } },
});
```

Replace the example layer IDs with IDs inspected from the animation. Nodes have local unique
IDs and named image inputs; references can appear before their producers in the node array.
Each node executes once per frame, in dependency order. Branches may reuse the same result.
All nodes must contribute to the single output; missing connections/output, duplicate IDs,
cycles and unreachable nodes reject. Referenced source layers must exist. A source selects
one or more layers using the existing [shot pass rules](#render-selected-shot-layers-as-a-pass): ancestor
placement, masks, sibling clipping dependencies, animation, controllers, meshes and camera still
apply. Group selection includes its subtree. Source images are always transparent outside their
artwork. The requested scene/transparent background is composited behind the final graph output,
so it is not graded or masked by the graph. An explicit graph and `layerIds` are mutually
exclusive. A `layerIds` pass bypasses the stored graph; `compositing: null` explicitly bypasses
it for a full-layer render. Omitting both uses the stored graph, if present. Background options
still select scene or transparent output independently.

The four node types are:

- `source`: explicit `layerIds` from this shot; no external file or arbitrary code input.
- `effects`: `input` plus the same ordered `LayerEffect[]` used by layers, including repeat kinds.
- `blend`: `background`, `foreground`, existing blend `mode`, and foreground `opacity` (0..1).
- `mask`: `input`, `mask`, and `mode: 'in' | 'out'`; multiply input alpha by mask alpha or its inverse.

Mask RGB does not affect coverage. For example,
`{id: 'cut', kind: 'mask', input: 'grade', mask: 'actor', mode: 'in'}` uses the actor pass's
alpha as a matte. Blend/mask use the same native Canvas operations as layer compositing;
effect nodes reuse the layer stack's filter preparation and ordered evaluator. Effect values and
blend opacity support eased shot-local keys, alongside source layer animation. Topology, blend
mode, mask mode and shadow RGB remain static. Arbitrary shader/function nodes are not provided.

Every port carries an RGBA frame at the shot's dimensions, after camera placement. Pixels outside
that finite frame are transparent and each pass is cropped to it. Graph filters do not recover
offscreen artwork or preserve halos beyond intermediate frame edges. Use layer/group effects
before source rendering when you need their expanded spatial sampling, then combine those passes
in the graph. Effect order and masks therefore intentionally differ from moving all effects into
a single layer. The current backend remains 8-bit; no high-precision/color-management claim follows.

Limits are 32 nodes, 32 KiB graph JSON, up to 16 effects per effect node and the usual
32-megapixel frame limit. Graph work also rejects above 256 megapixel-passes per frame, counting
one pass per source/blend/mask, at least one per effect node (or its effect count), and one for
final background composition. This bounds graph-level work; source-layer internals retain their
own geometry/surface limits. Shared inputs are counted once. Job manifest JSON still has its
separate 64 KiB limit. Validation and budget checks occur before graph rendering or new job
creation. Changing the graph requires a new job; resume uses the stored graph and matching source.

The frame-job study saves `compositing.json`, creates a separate graph job from the same source,
and compares that stored frame with direct graph rendering. It also saves a separate project
copy, attaches the graph through a durable plan, reopens it and renders an editorial job without
an explicit override. The graph includes two layer sources, grading, alpha masking and blending.
The graph operates on shot rendering; it is not a separate editorial-level graph.

### Save a shot's compositing graph

Use an ordinary shot edit or durable `animation.edit` plan:

```ts
const plan = project.plan('Set shot compositing', [{
  op: 'animation.edit', id: animation.id,
  edits: [{ op: 'compositing.set', graph: compositing }],
}]);
await project.commit(plan, { requestId: 'shot-compositing-v1' });
```

`compositing.set` replaces the complete graph; `graph: null` removes it. `putShotAnimation`
and standalone `defineShotAnimation` also accept the field. Source references are validated
against the resulting shot after a batch of edits, so a batch can add layers and connect them,
or remove a layer while revising/removing the graph. A dangling source reference rejects the
entire edit. References are not silently removed or rebound by layer name. Node IDs belong to
their graph and do not become globally addressable project objects or independent lock targets.

Normal shot rendering and editorial clips use the saved shot graph automatically, including
editorial transitions and jobs. There is no separate sequence-level graph applied after cuts.
Shot graph configuration participates in project revision/hash, locks, undo and durable commit
handling through the existing shot operation. A saved graph change requires a new job against
the resulting source revision; an older job cannot resume against changed source content.
Retain the source and matching engine needed by existing jobs.

Shot duplication retains local node IDs/connections and remaps every source layer reference to
the copied layer ID. Shot subset handoff retains graph data alongside the full shot. Three-way
shot merge includes the graph in its existing field/conflict handling and validates final layer
references. Keep the current engine pinned: older engines that lack this strict shot field
cannot read graph-bearing shots. Save/reopen, undo, duplication, merge and editorial pixel
qualification still require runtime evidence; static integration alone does not certify them.

### Animate compositing parameters

Effect nodes accept `keyframes` with `frame`, `easing` and nonempty `effectValues`. Blend nodes
accept `keyframes` with `frame`, `easing` and `opacity`:

```ts
const gradeNode = {
  id: 'grade', kind: 'effects' as const, input: 'actor',
  effects: [{ kind: 'brightness' as const, amount: 1 }],
  keyframes: [
    { frame: 0, easing: 'ease-in-out' as const, effectValues: [{ index: 0, value: 0.6 }] },
    { frame: 23, easing: 'linear' as const, effectValues: [{ index: 0, value: 1.2 }] },
  ],
};
const blendNode = {
  id: 'picture', kind: 'blend' as const, background: 'set', foreground: 'grade',
  mode: 'source-over' as const, opacity: 1,
  keyframes: [
    { frame: 0, easing: 'linear' as const, opacity: 0 },
    { frame: 23, easing: 'linear' as const, opacity: 1 },
  ],
};
```

These records replace the corresponding nodes in a complete graph passed to `compositing.set`
or render options. Keys use source-shot frame positions, including safe signed preroll/postroll
positions. A frame is unique within its node's key list. Each node may hold up to 4096 keys,
but the entire graph including all curves must still fit 32 KiB. Source and mask nodes do not
accept parameter keys. Node/key array order does not control interpolation.

Effect values reuse the layer key contract: `index` selects a stack slot, omitted `channel`
selects amount/degrees, and shadow additionally supports offsetX/offsetY/opacity. Each key
allows up to 64 distinct index/channel pairs; missing slots, unsupported channels, out-of-range
values, unknown fields and duplicate key positions reject. Entry easing overrides its key's
easing for that channel. Blend opacity is 0..1 and uses the key easing. Both paths share the
existing hold/linear/ease-in-out/bounded-Bezier evaluator, holding the nearest endpoint before
and after keys and using static values for unkeyed channels. Hue interpolates numerically.

Sampling uses the requested source frame without accumulating playback state. Editorial
source-in and frame-rate mapping therefore sample graph curves at the same local frame as
layer/camera animation; moving a cut does not shift source keys. Board retiming and project FPS
changes do not retime independently timed shots. Changing a shot's FPS/duration directly does
not automatically rescale any shot keys, including graph keys; use the explicit
`timing.retime` edit described in [animation](animation.md). Duplication and shot handoff retain local curve positions, while existing
three-way merge reports changes to graph data. Save the revised graph before creating a new job.

The frame-job consumer now authors brightness and blend-opacity curves, renders all 12 graph
frames and compares direct/inherited editorial frames in order 11, 0, 5. Its sheet includes
beginning/intermediate/end graph frames. These are executable checks for the later qualification
phase; they have not been run here and do not establish independent pixel correctness.
