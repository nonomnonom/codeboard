# Read drawings and exposures

Find the available drawings and authored holds without loading their artwork. Use a known drawing-group ID from the project query.

## Inspect drawing data in pages

```ts
const keys = project.production.drawingExposures('mouth-track', { offset: 0, limit: 50 });
const choices = project.production.drawingAlternatives('mouth-track', { offset: 0, limit: 50 });
```

These reads accept group IDs in board panels, components or shot animations. Exposure pages preserve sequence order and return detached `{ frame, drawingId }` records; `null` means the group has no drawing sequence, while `[]` means an empty sequence or a page beyond its end. Alternative pages preserve child order and contain only `{ id, name, kind }`, including for ordinary groups. Nongroup targets reject.

Both use offset pagination with default 50, maximum 200 records and a 256 KiB response limit. Oversized records reject with `RESOURCE_LIMIT` instead of truncation. Finish paging one project version before editing; these offset pages do not carry revision-bound cursors. Use `drawingNeighbors` for a drawing track in a board panel or shot animation, with a global board frame or local output frame respectively. Component definitions do not supply a timeline for this neighbor query. The existing `drawingSequence` returns the full sequence and child metadata and remains available for callers that explicitly need it.

