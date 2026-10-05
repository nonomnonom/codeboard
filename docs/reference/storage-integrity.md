# Check storage and read saved media

Use these APIs when verifying a project, extracting embedded files or supplying a version-pinned media reader. Normal editing starts with [projects](../workflow/projects.md).

## Check container integrity

`store.verify()` checks SQLite integrity and references, payload hashes, request receipts, the current document, derived object/catalog metadata and embedded asset checksums. It also decodes every named checkpoint and validates its document relationships, stored name/version, panel/component metadata and ordering, asset membership and checksums. A mismatch throws with its checkpoint or object identifier where available. The operation runs inside one read snapshot, writes no repairs and can be expensive for projects with many retained checkpoints. Successful integrity verification does not establish render fidelity or production approval.

Checkpoint record validation also runs on list/read operations: hashes, safe integer versions, unique IDs and contiguous object order must be valid, and the stored name must match its root. Reading a complete revision (including restore) checks its version and artwork/asset metadata against the decoded document through the same revision reader used by `verify()`. Legacy records may omit the studio root. Listing checks record structure without decoding artwork; full embedded-media checksum checks remain part of `verify()` or asset loading during save/restore.

## Studio counts in project summaries

`project.production.summary()` and `store.query(...).summary` include a `studio` object containing `animations`, `editorialSequences`, `editorialClips`, `audioTracks` and `audioClips`. Studio audio totals include tracks/clips authored on both animations and editorial sequences, including muted tracks; they do not multiply shot audio by its editorial uses. Existing `counts.audioTracks` and `durationFrames` continue to describe the board timeline. Studio sequences can use different frame rates and durations, so the summary does not invent a single combined studio duration.

The indexed query computes studio counts from the existing object catalog, without decoding studio artwork or media. Its persisted base summary format is unchanged. Partial panel updates retain the studio catalog entries, while a full save rebuilds them. Missing/stale catalogs still use the existing read-only document fallback and report `indexed: false`.

## Capture a saved media reader

`const readAsset = project.captureAssetReader()` captures the current saved container path and saved version. Pass this function to decoder adapters used during asynchronous work. Each call opens that captured source, checks its saved version inside the asset read snapshot and closes the connection. A later Save As on the project does not redirect the reader; a later save to the captured source causes a revision conflict. Unsaved projects cannot capture a reader.

This is a version-pinned reader, not a memory copy of every asset and not a retained checkpoint. It cannot read an overwritten old head. Create a new reader for a new saved source. Ordinary `project.readAsset(id)` continues to use the current saved source for that individual call. Local unsaved artwork edits do not create a new embedded-media snapshot.

`ProjectStore.inspect()` reads its saved version, panel count and payload statistics inside one read snapshot. If a project transaction or frame-job write fails and rollback also fails, an `AggregateError` retains the original operation error first and the rollback error second. Do not infer a clean rollback from that aggregate; close the failed store and inspect/reopen the file before retrying. Successful rollback preserves the original error unchanged. SQLite can also automatically roll back a transaction after errors such as `SQLITE_FULL`; the store checks the native transaction state and preserves that original error without attempting a second rollback.

`ProjectStore.readAssetIfPresent(id, {expectedVersion, asset?})` checks the saved-head version, asset declaration and embedded bytes inside one read snapshot. It returns `undefined` when the asset is not declared at that version, or when the optional requested asset has a different path/checksum/kind/MIME type. A stale version or a matching declared asset with missing/corrupt embedded data still throws. Save As supplies the requested asset so changed sources cannot inherit stale media. Copying checks the source version per asset rather than holding one source snapshot for the entire destination save; a later source change aborts the destination transaction.

Asset extraction can select an expected saved version or checkpoint: `store.extractAssets('handoff/media', {expectedVersion: 12, revision: 'approved'})`. The version applies to the selected revision (or saved head when `revision` is omitted). Metadata and embedded bytes are read under one database snapshot; a version mismatch rejects before output writes. The read snapshot lasts through synchronous extraction and can delay writers.

Extraction is incremental, not an atomic directory publication: existing identical files are accepted, differing files reject, and failure can leave earlier extracted files. Paths outside the destination, symbolic links (including directory junctions), and non-regular entries beneath it are rejected before extracting that asset. Use a trusted destination directory; these checks are not a sandbox against concurrent filesystem replacement. No extraction manifest or automatic cleanup of earlier files is added by snapshot pinning.
