# Projects and revisions

Save editable work as a `.cboard` file. A project contains scenes, shots, panels, layers, artwork, brush definitions, animation, and referenced asset data. PNGs, PDFs, and movies are exports, not replacements for the project.

## Configure production settings

Keep reusable project presets in code. Spread a shared options object into `StoryboardProject.create()`; no preferences file or background scheduler is required. Creation validates dimensions, FPS, seed, and document structure immediately.

Edit an existing project through `configure()` instead of rebuilding its JSON:

```ts
project.configure({
  title: 'Episode 01',
  author: 'Studio',
  canvas: { width: 1920, height: 1080, applyTo: 'all-panels' },
  frameRate: { value: 24, timing: 'preserve-seconds' },
});
await project.save('film.cboard');
```

`configure()` is one undoable edit. Invalid options, foreign locks on changed objects, collapsed timing, or unsafe frame positions reject the entire edit, including when you catch the error inside another transaction. Unchanged settings do not add a revision. Use `author: null` to remove the author. `seed` changes the stored project field; the renderer currently uses per-stroke seeds, so this does not reseed artwork or change its rendered texture.

Canvas width and height apply to newly created panels by default (`applyTo: 'new-panels'`). Choose `all-panels` to also replace the specified dimensions on existing panels. Artwork, camera coordinates, and review positions keep their coordinates: resizing changes the viewport, not the scale of the drawing. Background is a project-wide render setting. Movie export requires every panel to match the project dimensions.

Changing FPS requires an explicit timing policy:

- `preserve-frames` leaves every frame count unchanged. Playback duration changes, including frame-based audio trims and fades; source audio is not time-stretched.
- `preserve-seconds` converts panel boundaries, layer/camera keys, exposures, drawing changes, stroke reveals, transitions, comments, and audio timing to the new timebase. Positions round to the nearest frame, with half frames rounded up. Shared boundaries stay shared. Audio source offsets and durations are converted too, preserving source time to frame precision. Pen sample times stay in milliseconds.

Lowering FPS can merge distinct keys or erase a short exposure, transition, reveal, or panel. Conversion rejects these cases instead of deleting information; revise the affected timing first. Populated locked audio tracks must be unlocked before either FPS change. Fractional FPS values are supported. This operation resamples authored frame positions; it does not guarantee identical interpolation between those positions after rounding.

The CLI accepts the same `ProjectChanges` object in a JSON file:

```sh
codeboard configure film.cboard delivery-settings.json
```

The command validates the complete edit and saves through the normal stale-writer check. It does not force an overwrite.

## Save and reopen

```ts
await project.save('film.cboard');
const reopened = await StoryboardProject.open('film.cboard');
const panel = reopened.panel('notice');
panel.revise({ action: 'The keeper notices the broken light.' });
await reopened.save('film.cboard');
```

Keep IDs stable across sessions. Panel names, labels, and order can change without changing their identity. A save rejects a stale writer if another session changed the same file. Reopen the latest file and reapply the intended edit instead of forcing an overwrite.

`overwrite: true` deliberately replaces an existing project. Reserve it for generated outputs you own, such as the quickstart starter file. Do not use it for routine revisions.

## Separate source and outputs

A useful working folder is:

```text
my-film/
  scene.mjs
  revise.ts
  assets/
  film.cboard
  renders/
```

The authoring script creates artwork; the project preserves its editable state; render files are disposable outputs. If you revise the saved project, reopen it in your next script rather than rerunning a generator that replaces it.

## Save a named revision

```ts
import { ProjectStore } from 'codeboard-studio';
const store = ProjectStore.open('film.cboard');
try {
  store.saveRevision('before-camera-change', { expectedVersion: store.version });
  console.log(store.listRevisions({ limit: 10 }));
} finally { store.close(); }
```

Revision names must be unique. Revisions share unchanged artwork and assets with the project. They retain a state you can restore in another session; in-memory undo history is for the current authoring session.

```ts
const store = ProjectStore.open('film.cboard');
try {
  store.restoreRevision('before-camera-change', { expectedVersion: store.version });
} finally { store.close(); }
```

After restoring, reopen the project before further editing. Restoration changes the saved head; keep a named revision of any newer work you still want.

## Read a single panel

```ts
const store = ProjectStore.open('film.cboard');
try {
  console.log(store.findObjects({ panelId: 'notice', limit: 20 }));
  const panel = store.readPanel('notice');
  console.log(panel.title, panel.durationFrames);
} finally { store.close(); }
```

For a small artwork-only edit, use `updatePanel(panel, { expectedVersion })`. Use `StoryboardProject.open()` when adding or removing objects, changing timeline relationships, or retiming. Always close a store when finished.

## Reuse artwork

`production.captureComponent(layerId, name)` stores a reusable static group or layer. `instantiateComponent(componentId, panelId, transform)` places a copy into another panel. Local edits belong to that instance. Source updates require `reviseComponent`, followed by an explicit `refreshComponentInstance` where you want them applied. Refresh replaces that instance's local artwork, so preserve local changes first.

## Check a project file

```sh
codeboard validate film.cboard
```

Validation checks the container and its references. Keep backups of valuable work. If a file fails validation, retain the original for recovery instead of overwriting it with a new project.

## Assets and source files

`production.addAsset` registers an image or audio source; `updateAsset` revises its metadata or path. Linked paths resolve against `assetRoot` when saving. `project.readAsset(id)` reads embedded bytes from an opened project. With a store, `readAsset(id)` and `extractAssets(directory)` retrieve saved asset data.

Changing an asset's path, checksum, kind or MIME type requires resolving its source again. Missing replacement media raises `ASSET_MISSING`; mismatched bytes raise `ASSET_CHECKSUM_MISMATCH`. Both reject the saved transaction, preserving the previous embedded asset and saved version. A failed edit-plan commit creates no receipt and can retry after the correct file becomes available. Metadata-only edits retain existing embedded bytes. Save As also retains embedded bytes for unchanged source declarations, even if their original files are gone; changed declarations cannot silently copy the old media. Relative replacement paths resolve against the destination file's directory unless `assetRoot` is supplied.

An explicit `assetRoot` reloads all declared assets from that location, including unchanged declarations, and requires them to exist. It does not fall back to embedded bytes when a file there is missing. Existing checksum pins still apply. See the [audio replacement study](visual-examples.md#replace-media-without-reusing-stale-bytes) for a saved failure/retry workflow and decoded-waveform evidence.

An explicit overwrite cannot borrow media from the destination merely because asset IDs and paths match. It requires external source bytes or, for Save As from an opened project, matching media from that project's version-checked reader. Ordinary saves without overwrite retain unchanged embedded assets.

Adding an image asset does not place it on a layer. Decode its pixels and create a raster surface when you want it in the composition. Brush tips are retained with their stroke definitions. Save/open does not depend on rerunning authoring code or fetching an AI model.

## Revisions and storage size

`saveRevision` stores a named state that shares unchanged payloads. `readRevision(name)` reads that state without changing the active head; `readPanel(id, { revision: name })` reads one panel from it. `restoreRevision` changes the saved head and requires an expected version.

Use `deleteRevision(name)` only when that checkpoint is no longer needed. `compact()` removes unreferenced stored data after revisions and artwork are discarded; it is a deliberate maintenance operation, not something to call after every small edit. Keep the project closed in other editing sessions while doing maintenance.

The `.cboard` container separates structured metadata, binary artwork payloads, and embedded assets. `store.inspect()` reports storage information. File size depends on the actual artwork, assets, and retained revisions; an MP4's size is not a useful estimate of the editable project's size.

## Version checks and undo boundaries

Most production edits accept `{ expectedVersion }`; use the version observed before a coordinated edit to reject stale assumptions. A project transaction groups synchronous changes into one undoable unit and rolls back if an operation throws. Do file reads and asynchronous renders outside its callback.

In-memory `undo()` and `redo()` do not substitute for named saved revisions across sessions. `toJSON()` materializes the document for interoperability and debugging; it is not the recommended persistence format or a bounded inspection call.

## Query saved metadata without decoding artwork

```ts
const store = ProjectStore.open('film.cboard');
try {
  const page = store.query({ kind: 'shot', limit: 20 });
  const next = store.query({ kind: 'shot', limit: 20, offset: 20 }, { expectedVersion: page.version });
  console.log(page.summary, page.items, page.indexed, next.items);
} finally { store.close(); }
```

`query` supports ID, direct parent, panel, kind and case-insensitive name filters across the same objects as authoring discovery. It returns `{ summary, version, items, indexed }`, with 50 records by default, at most 200, truncated display labels and a 256 KiB total response limit. Store pages use binary ID order. Match labels against their full stored value; IDs are never truncated.

Current saved catalogs read only derived SQL metadata. They do not decode project/artwork/brush payloads. These optional tables share the same save transaction as authoritative project data. Partial panel edits update only the affected catalog rows. The catalog's header fingerprint detects saves by older runtimes, which do not maintain it. Missing or stale catalogs fall back to a validated full-document read and report `indexed: false`. Reads do not migrate files; the next full save rebuilds the catalog. Catalog changes do not themselves change the container version; schema-5 projects still require a container-3-capable reader. `verify()` compares a current catalog with the authoritative metadata and rejects corruption. Legacy `findObjects()` remains a narrower panel-object index query.

## Schema 5 studio content and migration

New projects use document schema 5 and SQLite container format 3. `project.setStudio({animations, editorial})` atomically replaces the studio library through the existing transaction/undo/lock checks; `project.studio` returns a copy. Studio artwork lives in a separate immutable payload root and named checkpoints retain that root. The board timeline and its ordinary render/export commands remain independent.

Schema-3/format-1 and schema-4/format-2 files open as migrated in-memory documents. Schema 3 receives empty studio content; schema 4 retains its existing studio artwork and timing. They remain read-only on disk: save/commit, partial writes, checkpoint mutations and compaction reject them with `SCHEMA_MIGRATION_REQUIRED`. Use a new path:

```ts
import { migrateProject } from 'codeboard-studio';
const report = await migrateProject('legacy.cboard', 'studio.cboard');
console.log(report);
```

Or run `codeboard migrate legacy.cboard studio.cboard`. An existing destination is rejected. The current document, board timing, IDs, audit entries and embedded media are copied; the original remains unchanged. Named checkpoints and edit-request receipts stay in the original file. This migrates the storage envelope; it does not convert board panels into shot-local artwork. Keep the source for rollback and qualification. Older runtimes reject the new container version rather than silently dropping studio data or typed effects.

Migration regressions use files created by the original schema-3 and schema-4 writers,
with saved PNGs from those implementations. The schema-4 fixture includes local animations,
trimmed editorial clips, sample-addressed audio, embedded WAV bytes, a checkpoint and an
edit receipt. Tests compare the migrated document and board/shot/editorial renders, verify
that history remains in the unchanged source, and commit a new edit to the migrated file.
These fixtures qualify the exercised content; they are not proof of every legacy project or
cross-platform renderer combination.

Schema 5 and container 3 establish the compatibility boundary for persisted effects and effect
keyframes. Opening an old file does not rewrite it. The new destination uses the upgraded
document envelope; geometry, timing, identities and existing studio content are not deliberately
rewritten. Older JSON readers reject `schemaVersion: 5`, and older container readers reject
format 3 before editing. Legacy catalogs are bypassed so summaries reflect the upgraded
in-memory schema. This is a breaking storage compatibility change and still requires migration
round-trip/render qualification; static validation alone does not establish parity.

Document fingerprints include the schema version. Keep legacy published snapshots/jobs with
their original engine and source when their hashes must remain unchanged; migration does not
rewrite old render manifests, review evidence or receipts into new-schema approvals. Create
new jobs/review evidence against the migrated copy. There is no lossy downgrade exporter.

For a version-pinned copy, pass `{expectedVersion: 12}` as the third argument, or add `--expected-version 12` to the CLI command. A mismatch rejects before creating the destination. The option is captured before asynchronous work, and existing media copying rejects source-version changes during embedded reads. Current-format projects can use this same copy path.

The report includes `documentHash`, the canonical fingerprint of the captured normalized document, and `snapshotHash`, the fingerprint of `{documentHash, assets}` where `assets` contains `{id, sha256}` for every copied embedded asset in document order. The copy is reopened, its document compared with the captured fingerprint, and media read with the copied version check before success is reported. This reads each copied media payload again but does not retain all payloads together. A verification failure follows the same owned-destination cleanup path as a save failure. These hashes describe content, not SQLite file bytes or a signature; they do not include original checkpoints/receipts or renderer dependencies. Keep a snapshot copy immutable after handoff. This API does not create or resume a render job.

### Check container integrity

`store.verify()` checks SQLite integrity and references, payload hashes, request receipts, the current document, derived object/catalog metadata and embedded asset checksums. It also decodes every named checkpoint and validates its document relationships, stored name/version, panel/component metadata and ordering, asset membership and checksums. A mismatch throws with its checkpoint or object identifier where available. The operation runs inside one read snapshot, writes no repairs and can be expensive for projects with many retained checkpoints. Successful integrity verification does not establish render fidelity or production approval.

Checkpoint record validation also runs on list/read operations: hashes, safe integer versions, unique IDs and contiguous object order must be valid, and the stored name must match its root. Reading a complete revision (including restore) checks its version and artwork/asset metadata against the decoded document through the same revision reader used by `verify()`. Legacy records may omit the studio root. Listing checks record structure without decoding artwork; full embedded-media checksum checks remain part of `verify()` or asset loading during save/restore.

### Studio counts in project summaries

`project.production.summary()` and `store.query(...).summary` include a `studio` object containing `animations`, `editorialSequences`, `editorialClips`, `audioTracks` and `audioClips`. Studio audio totals include tracks/clips authored on both animations and editorial sequences, including muted tracks; they do not multiply shot audio by its editorial uses. Existing `counts.audioTracks` and `durationFrames` continue to describe the board timeline. Studio sequences can use different frame rates and durations, so the summary does not invent a single combined studio duration.

The indexed query computes studio counts from the existing object catalog, without decoding studio artwork or media. Its persisted base summary format is unchanged. Partial panel updates retain the studio catalog entries, while a full save rebuilds them. Missing/stale catalogs still use the existing read-only document fallback and report `indexed: false`.

### Capture a saved media reader

`const readAsset = project.captureAssetReader()` captures the current saved container path and saved version. Pass this function to decoder adapters used during asynchronous work. Each call opens that captured source, checks its saved version inside the asset read snapshot and closes the connection. A later Save As on the project does not redirect the reader; a later save to the captured source causes a revision conflict. Unsaved projects cannot capture a reader.

This is a version-pinned reader, not a memory copy of every asset and not a retained checkpoint. It cannot read an overwritten old head. Create a new reader for a new saved source. Ordinary `project.readAsset(id)` continues to use the current saved source for that individual call. Local unsaved artwork edits do not create a new embedded-media snapshot.

`ProjectStore.inspect()` reads its saved version, panel count and payload statistics inside one read snapshot. If a project transaction or frame-job write fails and rollback also fails, an `AggregateError` retains the original operation error first and the rollback error second. Do not infer a clean rollback from that aggregate; close the failed store and inspect/reopen the file before retrying. Successful rollback preserves the original error unchanged. SQLite can also automatically roll back a transaction after errors such as `SQLITE_FULL`; the store checks the native transaction state and preserves that original error without attempting a second rollback.

Project recovery regressions kill a separate writer immediately before COMMIT with a populated rollback journal, and immediately after COMMIT before the caller receives its receipt. Reopening recovers the previous document in the first case and the committed document plus receipt in the second. A fresh worker retries the same saved plan/request ID; repeated retries do not duplicate the edit. The checks cover exact raster bytes/render output, retained named checkpoints, payload/reference integrity and SQLite integrity. A database page limit separately forces a real `SQLITE_FULL`, verifies that no partial document or receipt survives, and retries after reopening without the limit. This is a bounded capacity test, not physical disk exhaustion, power-loss qualification or interruption at every native COMMIT instruction. Keep the project and any SQLite journal together during crash recovery.

`ProjectStore.readAssetIfPresent(id, {expectedVersion, asset?})` checks the saved-head version, asset declaration and embedded bytes inside one read snapshot. It returns `undefined` when the asset is not declared at that version, or when the optional requested asset has a different path/checksum/kind/MIME type. A stale version or a matching declared asset with missing/corrupt embedded data still throws. Save As supplies the requested asset so changed sources cannot inherit stale media. Copying checks the source version per asset rather than holding one source snapshot for the entire destination save; a later source change aborts the destination transaction.

Asset extraction can select an expected saved version or checkpoint: `store.extractAssets('handoff/media', {expectedVersion: 12, revision: 'approved'})`. The version applies to the selected revision (or saved head when `revision` is omitted). Metadata and embedded bytes are read under one database snapshot; a version mismatch rejects before output writes. The read snapshot lasts through synchronous extraction and can delay writers.

Extraction is incremental, not an atomic directory publication: existing identical files are accepted, differing files reject, and failure can leave earlier extracted files. Use a trusted destination directory; lexical asset-path checks are not a sandbox against concurrent filesystem replacement or symbolic links. No extraction manifest or automatic cleanup of earlier files is added by snapshot pinning.

## Publish a pinned native snapshot

`publishProject` copies the complete saved container into a new `publish-…`
directory. It retains the current project, named checkpoints, commit receipts,
embedded media and other stored history. It does not select a single asset or
remove unrelated project content. The source must use the current container
format; migrate legacy files before publishing.

```ts
import { StoryboardProject, publishProject, verifyProjectPublish } from 'codeboard-studio';

const sourcePath = 'work/scene.cboard';
const source = await StoryboardProject.open(sourcePath);
const published = await publishProject(sourcePath, 'published', {
  expectedVersion: source.version,
  maxBytes: 256 * 1024 * 1024,
});
// Retain this pin outside the publish directory, for example in the task packet.
const pin = published.manifestHash;
const verified = await verifyProjectPublish(published.directory, {
  expectedManifestHash: pin,
});
console.log(verified.runtimeMatches, verified.manifest.externalFonts);
const working = await StoryboardProject.open(verified.projectFile);
await working.save('work/scene-next.cboard');
```

The output contains `project.cboard` and `manifest.json`. The manifest records
container bytes/SHA-256, project ID/version/content hash, engine implementation
identity, and text font declarations. It is written last, after the copy has been
verified. A source that changes during backup rejects if the resulting snapshot
differs from the requested source. Existing files are never replaced. Ordinary
failures remove owned temporary outputs; a killed process can leave an incomplete
directory without a completion manifest. The default and maximum copy budget is
1 GiB; manifests are limited to 256 KiB. Both operations accept an `AbortSignal`.

For a native copy without a publish manifest, call
`await store.copyTo(newPath, {expectedVersion})` on an open `ProjectStore` and keep
the store open until it completes. This uses the
[Node SQLite backup API](https://github.com/nodejs/node/blob/v22.22.0/doc/api/sqlite.md#sqlitebackupsourceDb-destination-options),
verifies the pinned result, and publishes the new file with an exclusive link.
The destination filesystem must support hard links. A regular SDK save to another
path remains appropriate when only the current editable document is needed.

Native copy also accepts supported legacy containers. It preserves their container format,
checkpoint roots, receipts and embedded media without authoring into the source. The copied
legacy file remains read-only under this engine; `store.inspect().writable` reports whether
the container supports current mutations, while `formatVersion` reports its stored format.
This flag describes format compatibility, not operating-system permissions. Use native copy
to retain a rollback/archive before `migrateProject` creates a current-format working copy.
The returned document hash describes this engine's normalized in-memory document, not the
legacy engine's schema-specific fingerprint or the SQLite file bytes.

`publishProject` can package that verified native legacy copy with a newly generated manifest.
Its new manifest uses this engine's normalized document identity; it does not reinterpret or
replace an older publish manifest. Verification under this engine does not make the archived
container writable or prove legacy render parity. Use `migrateProject` before editing it.

Verification checks native container integrity, file hashes and source identity.
Supplying the separately retained manifest hash also detects replacement of the
manifest itself. Without that pin, verification checks internal consistency,
not the provenance of the supplied package. Published files are not made
filesystem-read-only: edit a separate working copy and retain the old pin.

`runtimeMatches` compares the recorded engine implementation, package version,
Node version and platform to this process. It does not qualify render parity or
pin every native rendering/codec dependency. `externalFonts` lists CSS font
declarations, including those covered by explicit file pins. Optional `fontFiles` declarations
copy checksum-verified fonts into the published directory. Verification checks those bytes
without registering fonts; pass `verified.manifest.fontFiles` to `createFrameJob` to render
with them after handoff. Original authored family names stay unchanged. Source paths use the
same contained, project-relative rules as [frame job fonts](export.md#persistent-png-frame-jobs).
Missing or altered bundled font files reject verification. The 1 GiB container budget is
separate from the font budget of 64 files, 32 MiB per file and 128 MiB total. License files
remain explicit handoff material; the publisher does not infer or copy them automatically.
Undeclared font availability and glyph fallback remain outside this verification. Source loss,
embedded-media retention, checkpoints/receipts and a resumed edit are exercised
by the [publish study](visual-examples.md#resume-from-a-verified-publish).
