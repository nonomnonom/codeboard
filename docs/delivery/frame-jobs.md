# Resume a frame render

Save rendered PNG frames in a job file so interrupted work can continue. Keep the source project and renderer unchanged while the job is in use.

<!-- study:frame-jobs:start -->
**Continue an interrupted render.** Must a stopped render start again from the first frame?

[![The first two samples were already rendered. The last comes from the resumed job. Their captions identify which work was kept.](../../website/public/art/guides/frame-jobs.png)](../../website/public/art/guides/frame-jobs.png)

The first two samples were already rendered. The last comes from the resumed job. Their captions identify which work was kept. The job retains completed frames and renders the remaining ones. Pictures show the output; the progress report records reuse.

<!-- study:frame-jobs:end -->

## Persistent PNG frame jobs

For text dependency checks, set `fontPolicy: 'require-available'` in `createFrameJob` options. Creation and every `runFrameJob` call inspect all text in referenced shots, including hidden drawings. A missing explicitly named family anywhere in a fallback list, invalid shorthand, or unsupported shorthand rejects with `MISSING_DEPENDENCY` before rendering. Existing jobs and the default `allow-fallback` policy retain backend fallback behavior.

`inspectShotFonts(animation)` and `inspectProjectFonts(project)` return a bounded report with owner/layer/element IDs, requested families and actual families used by the backend for the element's text. Project inspection also includes board panels and component sources. Unquoted `serif`, `sans-serif`, `monospace`, `cursive`, `fantasy` and `system-ui` are system mappings; they do not pin a particular font. Quoted names are checked as explicit family names. CSS escapes in family declarations are reported as unsupported rather than guessed. Reports are limited to 4096 text elements, 1 MiB total text and 256 KiB serialized output; narrow the inspection to a shot if needed.

Load custom fonts through the installed `skia-canvas` `FontLibrary.use` before inspection or running a job. Its registry is process-wide; keep it unchanged during a render. Availability checks do not embed fonts, hash font binaries, guarantee individual weights or glyph coverage, or ensure cross-machine pixel parity. Resolved fallback families remain visible in the report.

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

Renderer identity includes package version, Node/platform, CPU architecture, the installed Skia Canvas package version, Sharp's reported dependency versions (including libvips and LittleCMS), and a hash of the engine's on-disk JavaScript/TypeScript files. Source and built installations therefore differ, and even unrelated engine edits can invalidate a job. Keep the installation immutable throughout a process lifetime. Backend version differences reject resume before new frames are written. Older manifests without backend metadata remain readable but do not match the current renderer for resume; use their original installation or create a new job. Identity also hashes loaded Skia/Sharp native addons and libvips shared libraries reported by Node, using filenames and SHA-256 rather than absolute installation paths. A different hash rejects resume even when reported versions match. Missing historical binary metadata also prevents a runtime match. The map covers only the named files: it does not pin fonts, OS libraries, every transitive library, WASM payloads or runtime settings such as GPU selection. Keep native files unchanged for the process lifetime; the hashes describe their on-disk bytes, not a dump of mapped executable memory. Checksums detect byte changes, not visual correctness or authenticity. Jobs store picture PNGs; exportFrameJobMovie assembles them with an explicit studio audio policy.
