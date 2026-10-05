# Deliver stored frames

Turn a completed frame job into a movie or PNG sequence. The saved frames are reused; you do not need to render them again.

<!-- study:frame-jobs:start -->
**Continue an interrupted render.** Must a stopped render start again from the first frame?

[![The first two samples were already rendered. The last comes from the resumed job. Their captions identify which work was kept.](../../website/public/art/guides/frame-jobs.png)](../../website/public/art/guides/frame-jobs.png)

The first two samples were already rendered. The last comes from the resumed job. Their captions identify which work was kept. The job retains completed frames and renders the remaining ones. Pictures show the output; the progress report records reuse.

<!-- study:frame-jobs:end -->

## Encode a completed frame job

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

## Deliver a stored PNG sequence

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
publish after rendering is finished.  

## Verify a delivered frame sequence

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
a sender or promises files remain unchanged.

## Verify stored job integrity

`await verifyFrameJob('picture.cjob', {signal, onProgress})` verifies every present frame's SHA-256 under one SQLite read snapshot. It needs neither the saved source nor the original renderer. Results include the manifest, `verified`, `missing`, `bytes` and `complete`. Incomplete jobs can pass integrity verification with `missing > 0`; missing frames are reported rather than treated as corruption. A checksum mismatch or inconsistent record count rejects. Progress counts visited positions in the whole job range, including missing positions.

The verifier reads one bounded PNG at a time and yields between positions for cancellation. It performs no writes and does not decode images, authenticate a sender or certify visual correctness. Its result describes that snapshot, not future writes. The read transaction may delay writers; run verification after workers finish when possible. `inspectFrameJob` remains the cheaper metadata/count query. Manifest JSON is capped at 64 KiB on both creation and reading, with limits measured in UTF-8 bytes; SQL suppresses oversized manifest/frame payloads before transferring them to JavaScript.

Executable lookup failures in movie encoding or the FFmpeg audio decoder use the structured `MISSING_DEPENDENCY` error, naming FFmpeg/ffprobe and the selected executable. Movie encoding waits for successful process startup before requesting PNGs. This does not preflight codecs or skip source/audio preparation; permission, codec and media errors retain their own failure paths. See [dependency handling](../reference/errors.md#missing-media-executables).
