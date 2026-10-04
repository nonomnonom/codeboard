# Project storage

`.cboard` is SQLite, application ID `0x43425244`, container version 1. Node's built-in `node:sqlite` owns file locking, transaction journaling, integrity checks, and SQL indexes. The document schema is version 3. Unknown versions fail; no prototype-format adapter or migration layer is provided.

## Ownership and layout

- `roots`: small project structure, brush library, and timeline settings; no panels, components, or change history embedded in that root.
- `panels` and `components`: independently addressed records and small metadata indexes. One panel can be decoded without loading the other artwork.
- `objects`: stable-ID/name/kind/panel index for bounded searches. It is updated transactionally with the panel.
- `payloads`: immutable SHA-256-addressed data. Identical brushes, tips, point sequences, contours, and asset bytes share stored content. The hash includes the payload type.
- `payload_links`: dependency edges used to collect unreachable immutable payloads.
- `assets`: stable asset IDs referring to one embedded byte payload. Paths/provenance remain metadata. A relocated project can export from these bytes.
- `changes`: small audit entries, separate from primary artwork. Not persisted undo snapshots.

Numeric samples and contour coordinates use little-endian IEEE-754 Float64. Presence flags retain omitted point attributes. Bitmap alpha arrays use byte storage only when all original values are exact integers in the byte range; fractional values use Float64. There is no quantization or loss of pressure/tilt/time precision. Path opcodes retain editable M/L/Q/C/Z structure. Brush settings remain immutable stroke snapshots but their storage payloads are deduplicated.

Each payload uses lossless Brotli quality 5 only if compression reduces its size, otherwise raw bytes. The small tree codec uses escaped tagged tuples, so user metadata cannot collide with an internal reference marker. SHA-256 is verified when a payload is read. Integrity checking is corruption detection, not authentication against a malicious party who can rewrite the entire database and its hashes.

`readPanel` also checks that the requested ID and indexed panel metadata match the decoded panel, including when reading a named revision. It still reads only that panel's artwork. `ProjectStore.verify()` runs in one database read snapshot and additionally compares the current object-search and component indexes with decoded artwork, verifies the embedded asset ID set and payload types, and checks declared asset checksums. SQLite page integrity and valid payload hashes alone do not prove these derived indexes are correct. Detected mismatches fail with an error; verification does not silently rebuild indexes or modify the project. Partial reads do not certify unrelated indexes or historical document structure.

Full document validation checks unused component artwork as well as panels: mask references/cycles, layer/element compatibility, brush tip and paper-texture dimensions, pen timestamp order, keyframe positions and stable IDs. Library presets are checked even before a stroke uses them. Component-source references are checked in both panel instances and stored source layers. Partial panel access still does not decode all unrelated component artwork; use full open or `ProjectStore.verify()` for that coverage.

Artwork arrays are stored as ordered references to blocks of at most 32 elements. Editing one element replaces its block and the small reference lists above it; untouched blocks and geometry remain shared. This bounds metadata duplication for a local edit without creating a database row for every small mark. It is not a per-coordinate delta format. Inserting or removing an element can repartition later blocks in that layer, and reading/editing still materializes the requested panel.

The container includes source paint commands, exact brush settings/tips, seeds, editable vector geometry, authored RGBA8 pixel surfaces, masks, layers, components, camera keys, exposures, transitions, audio decisions and source audio bytes. Pixel buffers use immutable 64 KiB binary blocks, independently compressed and deduplicated. Source RGB and alpha bytes are preserved exactly. It excludes brush dabs, cached canvases, exported PNG/PDF/video, and in-session undo data. Automatic raster checkpoints are not currently implemented; ordered surface compositing and stroke replay reconstruct the current raster painting. No flattened result substitutes for editable source data.

## Transactions and partial work

`StoryboardProject.open/save` are full authoring sessions. Saving validates the document, encodes one panel at a time, and updates only changed rows/hashes. It still traverses the full authoring document; it does not promise constant-time full saves.

Authoring transactions are synchronous. Call `await project.save(path)` after `project.transaction(...)` returns successfully. Saving inside an active transaction returns a rejected Promise before opening or creating any file, so a later authoring rollback cannot leave uncommitted artwork on disk. `undo()` and `redo()` throw inside an active transaction before consuming history; finish the transaction or throw from its callback to cancel it first. These checks also apply within nested authoring calls. Reading the working document during authoring remains allowed.

`ProjectStore.readPanel`, `panelDocument`, `findObjects`, and `updatePanel` are targeted operations. The panel is the storage edit unit. `updatePanel` supports path/sample/settings/framing-layer/annotation/caption changes while preserving stable identity topology and panel timing. Additions/removals and global retiming use the full authoring API. No other panel's drawing payload is decoded for a targeted revision. The lightweight metadata skeleton is used to validate the revised panel's relationships.

Every write runs inside `BEGIN IMMEDIATE` with `synchronous=FULL`, foreign keys enabled, and an expected document version. Readers use read snapshots. A stale writer fails. SQLite's rollback journal handles an interrupted commit; no full `.previous` JSON backup is made. Tests terminate a separate writer inside an unfinished transaction and reopen the prior committed artwork. Failure recovery still depends on a functioning filesystem and storage device; this is not a substitute for user backups.

Replacing an existing project does not reset its concurrency version. `ProjectStore.save()` returns the committed version, advancing beyond the previous stored version when data changed but the supplied authoring version did not advance. Explicit overwrite advances it even for an otherwise identical replacement. `StoryboardProject.save()` adopts that committed version only after success; low-level store callers must retain the returned value or read `store.version` for their next expected-version check. The input document passed to the store is not mutated. An unchanged normal save retains its version and payloads. Change detection compares this connection's [SQLite total_changes counter](https://www.sqlite.org/c3ref/total_changes.html) within the write transaction; other writers are excluded by `BEGIN IMMEDIATE`, not detected through that counter. This prevents an old session from becoming valid again after regeneration happens to reuse its former version number.

Embedded assets remain unchanged on unrelated saves even if the external source file changes. To replace bytes, explicitly update the asset path/checksum through `production.updateAsset` and provide the intended source root. Save-as carries embedded assets forward. Export from a stale open asset source is rejected rather than silently using another writer's bytes.

`compact()` is explicit maintenance: collect unreachable payloads, then SQLite VACUUM. Old immutable payloads can remain between revisions until compaction, and named revisions explicitly retain their referenced roots; other unreachable payloads are not an alternative source of truth. Compaction is not part of a small edit. Derived render caches remain outside the container.

## Runtime and limits

Local production animation edits use the owning panel transaction scope: transition changes, drawing exposure, and adding, updating or removing layer keyframes. Multiple such edits in one transaction copy the affected panel once. Ownership is resolved before mutation and panel locks are checked directly. Retiming and camera edits remain document-scoped; their effects are not assumed to stay within one panel. Regression tests verify untouched panels are not snapshotted, undo/redo restores animation values, and a failed transaction restores both artwork and timing.

In-session undo/redo applies patches by copying only changed ancestor objects/arrays and any edited pixel buffer. Unchanged artwork and resources remain shared internally; public document/layer reads still return independent values. Several byte-range edits to one pixel buffer copy that buffer once per application, not once per patch. This is separate from disk revision deduplication.

Authoring transactions now copy a panel on its first local write, retaining untouched panels for rollback without cloning them. Layer/element creation, editing/removal, annotations, and caption edits use this panel scope; metadata has its own scope. The unit is a whole panel, including its pixel surfaces, not a tile or individual stroke. Broad production operations, including retiming and component changes, conservatively expand to a document snapshot, preserving any already writable panels. All paths share the same commit, validation, audit and undo handling. Whole-document schema validation still traverses and temporarily materializes project data, so transactions are not constant-memory or fully incremental.

The Node binding is synchronous and experimental in Node 22. It blocks its calling thread; host it in a worker for an interactive application. Only the pinned Windows environment has been measured. SQLite itself is mature and public domain. The filesystem/container format is not browser storage. Full movie export currently loads the authoring document, although individual panel rendering is partial. Recovery does not restore unsaved JavaScript operations after the process exits.

Sources: [Node 22.22 SQLite API](https://nodejs.org/download/release/v22.22.0/docs/api/sqlite.html), [SQLite atomic commit](https://sqlite.org/atomiccommit.html), [file format](https://sqlite.org/fileformat.html), [WITHOUT ROWID trade-offs](https://sqlite.org/withoutrowid.html). Large BLOB payloads use an ordinary rowid table; small keyed metadata tables use WITHOUT ROWID. ZIP was considered for interchange but requires archive rewriting for normal revisions and does not provide transactional indexed updates. A directory of independent blobs needs an additional cross-file commit protocol. SQLite supplies that ownership instead of a new proprietary container protocol.

## Named revisions versus independent copies

`save(otherPath)` is an independent, portable copy and must carry its own media. It is not the normal revision workflow. The example previously used that operation for `last-light.revised.cboard`; this unnecessarily duplicated almost the whole project and has been replaced.

A revision now stores a small manifest of root references inside the same container. Drawings (`elements` arrays) are separate content-addressed payloads from panel/layer placement and timing. Unchanged artwork, tips, textures, and audio are shared. Changed content receives a new hash, so old revisions preserve their actual artwork, not just timeline settings. Checkpointing does not decode or copy drawing/media payloads.

```ts
const store = ProjectStore.open('last-light.cboard');
try {
  store.saveRevision('director-approved', { expectedVersion: store.version });
  console.log(store.listRevisions());
  const approved = store.readRevision('director-approved'); // full materialization when requested
  // renderPanelPNG(approved, panelId) reviews the older state.
  // readAsset(assetId, { revision: 'director-approved' }) reads its exact media.
  store.restoreRevision('director-approved', { expectedVersion: store.version });
} finally { store.close(); }
```

A restore is a new atomic head commit with a monotonically increasing version; it restores artwork, timing and embedded media, while retaining the current audit trail. Foreign locks block restore. Duplicate revision names fail rather than overwrite history. `deleteRevision(name)` removes its retained root; bytes are reclaimed by an explicit `compact()` only when no head or remaining revision refers to them. The repair example is idempotent: rerunning it does not apply another zoom or create another copy.

Toon Boom comparison: [Saving Several Versions of a Project](https://docs.toonboom.com/help/storyboard-pro-22/storyboard/project/save-as-new-version.html) explains that versions preserve structure, captions, timing, camera/layer animation and track/clip settings, while drawings, palettes and source media are shared. Consequently a drawing edit can affect other Toon Boom versions. Codeboard deliberately shares **immutable** drawing payloads so older named artwork revisions remain isolated. This is our design choice, not a claim about Toon Boom internals. The official page was available through the search index on 2026-10-04; its direct URL returned 404 during this check.

The current [Toon Boom saving guide](https://helpcentre.toonboom.com/hc/en-ca/articles/48953712339091-About-saving-options-in-Storyboard-Pro) distinguishes unpacked `.sboard`, packed `.sbpz` (working saves target an extracted cache; Save and Pack updates the archive), and compact `.vdb` storage for compatible elements. It does not disclose the internal database technology or an immutable revision implementation, so we do not infer either.

For partial historical review, use `readPanel(id, { revision: name })` or `panelDocument(id, { revision: name })`. Only the requested panel's drawing is decoded. Current object search indexes apply to the head; historical global object search is not yet indexed separately.

## Local layer revisions in memory

Layer reorder/removal and component instantiation/explicit instance refresh now use the owning panel's mutation scope. A transaction copies that panel once and shares unrelated panels until a wider operation actually needs them. Removing a layer replaces the review-comment array to remove its anchors; it does not mutate comment records shared with the previous state. Undo/redo retains the corresponding comments and artwork, and a failed transaction restores both. Component source capture/revision and timeline-wide operations still use broader scopes; this pass does not claim all authoring operations are incremental.
