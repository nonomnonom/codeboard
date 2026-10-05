# Find artwork by ID

Query the project to locate a layer, element or timing record. Check the returned kind and owner before editing it.

## Inspect before editing

Use `project.production.summary()` for project identity, format, duration and counts without artwork or unbounded audio/comment lists. The legacy `inspect()` returns a larger overview; it is not the default tool response for an agent.

```ts
const summary = project.production.summary();
const shots = project.production.query({ kind: 'shot', limit: 20 });
const shot = shots.items[0];
if (!shot) throw new Error('No shot found; create or import one first');
const children = project.production.query({ parentId: shot.id, limit: 50 });
// Read the next page only when needed and keep the same filters.
const next = children.nextCursor
  ? project.production.query({ parentId: shot.id, cursor: children.nextCursor })
  : null;
```

Check that a query returned the expected object before using its ID. `query()` and `find()` discover projects, sequences, scenes, shots, camera/layer keys, panels, layers/elements, components, assets, brushes, audio tracks/clips, comments and locks. `parentId` means direct owner, not arbitrary descendants; `panelId` scopes panel artwork and review anchors. Drawing alternatives are group children. Use `production.drawingAlternatives(groupId, options)` for child metadata pages and `production.drawingExposures(groupId, options)` for exposure pages; neither returns artwork.

`query()` returns `{ version, items, nextCursor? }`, with 50 items by default and a maximum of 200. Labels are limited to 256 UTF-16 code units and marked `nameTruncated` when shortened; matching uses the full label. IDs are never truncated. A page over 256 KiB fails with `RESOURCE_LIMIT`; reduce its limit or narrow its filters. No geometry or pixel payload is included.

Cursors belong to one open project instance and edit state. Changing filters, editing, undoing or reopening requires restarting the query. A mutation attempt may invalidate a cursor even if it fails. `find()` retains offset pagination and full labels for existing scripts. Neither is a recursive ownership selector.

For independent CLI invocations, use a saved version with offsets instead of an in-memory cursor:

```sh
codeboard query film.cboard --kind shot --limit 20
codeboard query film.cboard --kind shot --offset 20 --expected-version 42
codeboard drawing-data film.cboard mouth-track --kind exposures --limit 50 --expected-version 42
```

Replace `42` with the first response's `version`. `query` emits JSON through `ProjectStore.query()`. Results include `indexed: true` when a current saved metadata catalog is available. This path reads no artwork, brush or document payloads. Legacy files or files saved by older runtimes may return `indexed: false` and use a full-document fallback; queries never rebuild or write the catalog. The next normal save rebuilds it atomically. Store/CLI pages sort IDs in SQLite binary order, while in-memory discovery uses hierarchy order. Use the same path and filters across offset pages and retain the expected version. The entire store response, including summary, is capped at 256 KiB. The existing `inspect`/`ProjectStore.findObjects` path retains its narrower panel-object scope.

`CodeboardError` provides `code`, `details`, `retryable` and `toJSON()`. Query failures use `INVALID_ARGUMENT`, `INVALID_CURSOR`, `STALE_CURSOR` or `RESOURCE_LIMIT`. Saved-version conflicts use `REVISION_CONFLICT` with expected/actual values. A conflict requires reading the latest state and reconsidering the edit, not blindly retrying it. Some SDK operations still throw ordinary errors. The main CLI command rejection boundary serializes these as `OPERATION_FAILED` (or `CANCELLED` for an `AbortError`), while preserving structured domain codes. It writes `{ error: ... }` to stderr and sets exit status 1. Inspect the failure before deciding whether to retry.

CLI reports may include `error.causes`: ordered aggregate failures or a single wrapped cause. Each entry uses the same error envelope. Cause traversal stops after three edges and includes at most eight immediate aggregate children, with `causesTruncated` reporting omitted immediate causes. Domain `details` are preserved separately; stacks are not emitted by this formatter. These cause-count/depth limits are not a byte budget for custom domain details. Startup failures before command parsing and the separate user script process launched by `run` retain their own output paths.

Parser failures such as unknown commands/options, missing arguments and missing option values use the same JSON envelope with `INVALID_ARGUMENT` and `details.parserCode` from Commander. The parser's duplicate text diagnostic is suppressed. Help/version output retains Commander's text and exit status, including error-triggered help; it does not produce a JSON error envelope. This parser boundary is inherited by registered subcommands.

CLI registration defers project/storage/render/audio/preview imports until their command handler runs. Help, version and parser validation therefore do not deliberately load those backends. Module-loading failures during a selected command enter the command error formatter. This does not make `capabilities` or authoring independent of all native dependencies: capability/schema discovery and selected operations still load their own dependencies.

```sh
codeboard inspect film.cboard --panel panel:reaction --name Hand --limit 10
codeboard validate film.cboard
```

Inside a revision script, open the saved project and query `project.production.find(...)`. Read the element or layer identified by the result. Use a crop for a hand or contour problem, a frame sheet for timing, and a layer-isolated onion skin for consecutive drawings. Avoid sending an entire `toJSON()` dump to an agent when a bounded query will answer the question.
