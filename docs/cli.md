# Command line

Install with `npm install -g codeboard-studio`, or use `npx codeboard` with a project-local dependency. See [installation](install.md) for Node.js requirements, version pinning, and npm updates.

Run `codeboard --help` to list commands or `codeboard COMMAND --help` for one command's options.

| Command | Purpose |
| --- | --- |
| `codeboard init [file]` | Create an authoring script; defaults to `scene.mjs` |
| `codeboard run <script> [arguments...]` | Execute JavaScript or TypeScript with the Codeboard API |
| `codeboard preview <project>` | Open a local, read-only review server |
| `codeboard inspect <project>` | Read project metadata and find objects |
| `codeboard query <project>` | Query hierarchy, objects and review anchors as bounded JSON |
| `codeboard board-data <project>` | Page panel timing, transitions, dimensions and source IDs |
| `codeboard editorial-data <project> <sequence>` | Page editorial clip placement, source ranges and initial holds |
| `codeboard drawing-data <project> <group>` | Page drawing exposures or child metadata from a saved project |
| `codeboard mesh-data <project> <animation> <layer>` | Page mesh vertices, topology or key metadata with an optional saved-version check |
| `codeboard controller-data <project> <animation> <controller>` | Page controller keys or targets, optionally evaluated at a local frame |
| `codeboard review-verify <directory>` | Verify delivered review evidence and an optional saved decision |
| `codeboard validate <project>` | Check project integrity |
| `codeboard configure <project> <changes>` | Apply a JSON file of [project settings](projects.md#configure-production-settings) and save atomically |
| `codeboard plan <project> <commands> --label <text> [--actor <id>]` | Validate a JSON command array and emit a serializable [edit plan](agent-workflow.md#persist-a-retryable-edit-plan) |
| `codeboard commit <project> <plan> --request-id <id> [--actor <id>]` | Atomically save the plan and durable receipt; identical retries return the original receipt |
| `codeboard receipt <project> <request-id>` | Read a committed request receipt as JSON, or `null` if absent |
| `codeboard render <project>` | Export panel images and storyboard sheets |
| `codeboard frame <project>` | Render one version-pinned board, shot or editorial frame to a new PNG |
| `codeboard animatic <project>` | Export frame images and an animatic manifest |
| `codeboard movie <project> --output <file>` | Export an MP4 using FFmpeg |
| `codeboard --version` | Print the installed version |

## Authoring

```sh
codeboard init scene.mjs
codeboard run scene.mjs
codeboard run revise.mts --shot reveal
```

Arguments after the script filename are passed to that script through `process.argv.slice(2)`. Paths and outputs are relative to your terminal's working directory. `run` preserves script failure exit codes.

Scripts run as trusted local code with your file and network permissions. Review scripts from other people before running them. The runner does not sandbox them or impose a time limit; Ctrl+C interrupts a running script.

## Inspect objects

```sh
codeboard inspect film.cboard --panel notice --name Hand --limit 10
codeboard inspect film.cboard --offset 10 --limit 10
```

Use bounded results to locate an object before opening its artwork. `--limit` accepts up to 200 entries.

## Inspect board and editorial timing

For board conversion and editorial revisions, read the saved timing records first:

```sh
codeboard board-data film.cboard --limit 50 --offset 0
codeboard board-data film.cboard --limit 50 --offset 50 --expected-version 42
codeboard editorial-data film.cboard edit:main --limit 50 --expected-version 42
```

`board-data` returns `{version, indexed, frameRate, durationFrames, panelCount, items}` in board time
order. Each item has panel/shot IDs, start/duration, transition, dimensions and panel revision.
`editorial-data` returns `{version, sequenceId, frameRate, durationFrames, clipCount, items}` with clip IDs, source animation IDs,
source-in, placement/duration, transitions and optional `holdFrames`. Source-in uses the shot
clock; placement, duration and hold use the returned editorial frame rate. Query the shot owner
for its source rate; clip rows do not infer equal rates.

Both commands are read-only. Pages default to 50 and cap at 200 records; item responses above
256 KiB reject. Offsets are nonnegative safe integers; the limit must be positive. Reuse the
returned version for subsequent pages and planning. A different saved version returns
`REVISION_CONFLICT`. `board-data` reads panel metadata directly in one saved snapshot and never
decodes panel artwork. `indexed: true` means its project summary comes from the current catalog;
otherwise it reads the legacy/stale-catalog header without rebuilding or writing indexes.
This is metadata inspection, not proof that indexed timing matches the artwork payload; run
`validate` for full integrity checks. `editorial-data` selectively decodes the saved editorial
field without decoding sibling shot artwork or numeric/resource buffers. It still decompresses
and parses the studio's structural tree and reads the editorial collection, rather than an SQL
index per clip; large structural trees can therefore cost memory even for a short response.
Both paths fall back to reading the header when the project summary catalog is unavailable.
Use
`planBoardCapture` through `codeboard run` to prepare the [conversion plan](animation.md),
then the normal plan/commit/receipt workflow.

## Inspect drawing data

```sh
codeboard drawing-data film.cboard mouth-track --kind exposures --limit 50
codeboard drawing-data film.cboard mouth-track --kind exposures --offset 50 --expected-version 42
codeboard drawing-data film.cboard mouth-track --kind alternatives --expected-version 42
```

The command prints `{ version, items }`. `--kind` defaults to `exposures`; `alternatives` returns child IDs/names/kinds without artwork. Exposure `items: null` means an ordinary group without a drawing sequence; an empty array means an empty sequence or exhausted page. Both modes support board, component and shot group IDs. Frame values retain their owner domain: board global, shot local.

Limits default to 50 and cap at 200; item responses over 256 KiB reject. Limits must be positive decimal integers; offsets and expected versions must be nonnegative safe decimal integers. Pin subsequent pages to the first response's version with `--expected-version`; a changed saved snapshot rejects with `REVISION_CONFLICT`.

This command opens and validates a full project snapshot before applying the bounded read API. Bounded output does not mean indexed metadata-only loading. It does not write the project.

## Preview

```sh
codeboard preview film.cboard --port 4173
```

The server binds to your computer's loopback address. Open the printed URL and press Ctrl+C to stop it. The viewer is for review, not manual drawing.

## Common problems

| Problem | What to do |
| --- | --- |
| `codeboard` is not found | Open a new terminal after installation; check the [PATH instructions](install.md) |
| `init` says the file exists | Choose another filename or run the existing script |
| An import cannot be found | Use `codeboard run`, and import the engine as `codeboard-studio` |
| TypeScript syntax is rejected | Use erasable types or JavaScript; see [TypeScript support](quickstart.md#use-typescript) |
| FFmpeg is missing | Install it and set PATH, `FFMPEG_PATH`, or `--ffmpeg` |
| A saved project is stale | Reopen the latest project and reapply your revision |
| Exported text uses a different font | Install the intended font on the rendering computer |
| Windows cannot replace an MP4 | Close the player holding that file, then export again |

## Capability discovery

Run `codeboard capabilities` for a JSON implementation inventory without opening a project. Add `--probe-dependencies` to inspect FFmpeg and ffprobe startup in parallel, optionally with `--ffmpeg <path>` and `--ffprobe <path>`. Each probe has its own two-second timeout and 32 KiB output limit. Dependency startup success does not guarantee encoder/media compatibility. See [agent workflow](agent-workflow.md) for status semantics.

## Saved-snapshot review

`codeboard review film.cboard --output reviews --frames 0,24,47 --expected-version 12` creates a new PNG review package and prints its manifest/path as JSON. Optional `--revision <name>` selects a checkpoint; the expected version applies to that checkpoint. Add `--shot <animation-id>` for local shot frames or `--editorial <sequence-id>` for editorial frames; these flags are mutually exclusive. With neither flag, frames address the board timeline. Add `--annotations` for board motion annotations only. Manifests use `codeboard-review/2` with rational frame rate and explicit target/source-frame records. See [review](review.md) for completion markers and limits.

## Verify a delivered review

```sh
codeboard review-verify reviews/review-001 --decode
codeboard review-verify reviews/review-001 --decision decision.json --source film.cboard
```

Use the directory returned by `codeboard review`. Hash verification checks the
manifest and each listed file; `--decode` additionally checks PNG dimensions.
`--decision` verifies a saved decision's checksum and exact evidence binding.
`--source` also requires that decision to match the saved project; add
`--revision <name>` to select a checkpoint. Without `--source`, the JSON result
reports `sourceChecked: false`. Decisions are unsigned caller declarations;
verification neither authenticates a reviewer nor supplies artistic approval.

## Project format migration

`codeboard migrate source.cboard destination.cboard` copies the current document/media into a new schema-5, container-3 file and prints a migration report. The destination must not exist. Legacy files are read-only; checkpoints and request receipts remain in the original. Migration preserves board timing; explicit board-to-shot conversion uses `planBoardCapture` separately.

Add `--expected-version <number>` to reject a stale source before destination creation. This also supports copying current-format projects. The report includes document and snapshot-content hashes after reopening the copy and reading its embedded media; see [project copies](projects.md) for hash scope and retention limits.

For picture-only studio MP4, add `--shot <animation-id>` or `--editorial <sequence-id>` to `codeboard movie`. These selectors are mutually exclusive and do not include board audio. The default remains board movie export.

Studio movie audio: choose `--mix-audio sum|linear` or `--omit-audio` when audio is authored. Mixing accepts `--ffprobe <path>` and uses `--ffmpeg` for decoding/encoding; clipping rejects. These flags require a shot/editorial target.

### Deliver and verify audio stems

```sh
codeboard audio-stems film.cboard stems-options.json --editorial edit:main --expected-version 12 --output delivery/audio-v001
codeboard verify-audio-stems delivery/audio-v001
```

Choose exactly one `--shot <animation-id>` or `--editorial <sequence-id>`. `--expected-version` is required and applies to the saved head; checkpoints are not selected by this command. The version is checked before export, and embedded media uses a reader captured from that saved version. Decoder paths use optional `--ffmpeg <path>` and `--ffprobe <path>` flags.

The options file is a JSON `AudioStemExportOptions` object, limited to 1 MiB:

```json
{
  "transitions": "linear",
  "sampleFormat": "float32",
  "mix": {"sampleRate": 48000},
  "stems": [
    {"name": "Dialogue", "tracks": [
      {"ownerId": "animation:shot-a", "trackId": "audio:dialogue-a"}
    ]}
  ]
}
```

The API's option schema validates the file before publication; unknown fields and malformed values reject. To crop all stems identically, add `mix.range` with `startSample` and exclusive `endSample`. The destination must be new. Both commands print JSON and fail with a nonzero exit status on errors. SIGINT/SIGTERM requests cancellation through existing export/verification cleanup; abrupt process termination is not recoverable through this command. Verification streams sizes/hashes without modifying the package or decoding audio. See [audio delivery](audio.md) for manifest, media-pinning and interoperability limits.

### Render one saved frame

```sh
codeboard frame film.cboard --shot animation:greeting --frame 24 --expected-version 12 --output greeting-24.png
```

Use `--editorial <sequence-id>` for editorial time, or omit both selectors for the board timeline. `--revision <name>` selects a checkpoint; `--expected-version` then applies to that checkpoint. Frame and version must be nonnegative safe integers. The command reads a snapshot and closes the container before rendering. A version mismatch rejects before rendering; source edits after capture do not affect that frame. The output parent directory must exist. Existing output files are never replaced. JSON output identifies project/version, selected target, frame, revision and file path. This single-image command does not create a resumable render job or a review manifest; use `review` for a bounded review package.

## Persistent frame jobs

Create a job from a saved source, run it, then reuse the same job path after interruption:

```sh
codeboard frame-job create film.cboard --expected-version 12 --shot animation:greeting --start-frame 0 --end-frame 48 --output picture.cjob
codeboard frame-job run picture.cjob
codeboard frame-job inspect picture.cjob
codeboard frame-job read picture.cjob 0 --output frame-0000.png
```

Use `--editorial edit:main` instead of `--shot` for an editorial sequence; creation requires exactly one selector. Omit both range flags to use the whole selected timeline, or supply both for a half-open range. `--max-bytes` sets the stored PNG budget (default 512 MiB, maximum 1 GiB). Existing job destinations reject.

`run` accepts paired `--start-frame`/`--end-frame` flags for a worker range inside the job. `--source copied-film.cboard` relocates the source only if its ID/version/document hash matches. SIGINT/SIGTERM request cancellation; earlier committed frames remain. Re-running verifies visited stored frames and fills missing ones. Concurrent workers may duplicate rendering and can encounter SQLite contention; retries are explicit.

All four commands print JSON results to stdout. `inspect` reports row counts and the manifest without rendering; `complete` does not mean every checksum was verified. `read` verifies the selected PNG before reserving a new output file; it requires an existing parent directory and rejects overwrites. Ordinary write failure removes the file created by that call; abrupt termination may leave a partial output, so retry with a new filename or inspect/remove that output yourself. The job itself remains unchanged by reads.

Keep the source and engine installation unchanged. The engine identity check does not pin fonts or native dependencies. The create/run/inspect/read commands do not encode movies or mix audio; the movie command below handles delivery. No command schedules workers or establishes visual correctness. See [persistent PNG frame jobs](export.md#persistent-png-frame-jobs) for storage limits and recovery behavior.

### Movie from a frame job

```sh
codeboard frame-job movie picture.cjob --omit-audio --output picture.mp4
codeboard frame-job movie picture.cjob --mix-audio linear --output picture-with-audio.mp4
```

This command requires a complete job and its matching saved source, optionally relocated with `--source`. It verifies stored PNGs while feeding the shared movie encoder, without rendering again. Authored audio requires `--omit-audio` or `--mix-audio sum|linear`; the flags are mutually exclusive. `--ffmpeg` configures encoding and audio decoding; `--ffprobe` configures audio probing. SIGINT/SIGTERM request cancellation. Existing movie destinations reject, and stdout receives the JSON export result. It holds a read snapshot of the job while exporting, so finish workers before delivery. See [movie from stored frames](export.md#encode-a-completed-frame-job) for cleanup and media pinning limits.

### Verify a frame job

```sh
codeboard frame-job verify picture.cjob
```

This read-only command verifies hashes of all present frames in one SQLite snapshot and prints JSON containing `verified`, `missing` and `complete`. It works without the original project/renderer. An incomplete job can verify successfully and report missing frames; agents must check `complete` before delivery. Corruption rejects, and SIGINT/SIGTERM request cancellation. Verification does not decode PNGs or establish visual quality, and can delay concurrent writers while holding its snapshot.

## Inspect mesh data

```sh
codeboard mesh-data film.cboard animation:shot layer:art --kind keyframes
codeboard mesh-data film.cboard animation:shot layer:art --kind vertices --frame 12 --limit 50
codeboard mesh-data film.cboard animation:shot layer:art --kind vertices --frame 12 --offset 50 --expected-version 42
codeboard mesh-data film.cboard animation:shot layer:art --kind triangles --expected-version 42
```

JSON output contains the opened snapshot's `version` and a bounded `data` page. Follow
`data.nextOffset` with that version as `--expected-version`; a different saved version rejects.
A concurrent save after the snapshot opens does not alter that response. Omit `--frame` for
bind vertices; it is accepted only with `--kind vertices` and uses signed shot-local time.
Limits default to 50 and cap at 200, with a 256 KiB page budget. The command opens and validates
the full project; pagination bounds the response rather than file-loading cost. No changes
are saved by inspection. This command has passed static checks only, not CLI/SQLite execution.

Skin inspection uses `mesh-data <project> <animation> <layer> --kind joints` or `--kind weights`.
These collections accept the same `--limit`, `--offset` and `--expected-version` options.
`--frame` applies only to vertices; skin animation keys belong to the mapped joint layers.
See [live skin bindings](animation.md#drive-a-skin-from-animated-layer-joints).


Controller inspection: `controller-data <project> <animation> <controller>` accepts
`--kind targets|keyframes`, `--frame <signed-local-frame>`, `--limit`, `--offset` and
`--expected-version`. It returns `{ version, data }`. The default collection is keyframes;
frame evaluation adds the controller's weight and, for target pages, final blended local layer
states. Use the same expected version across pages. See
[controller inspection](animation.md#inspect-a-controller-in-bounded-pages).
