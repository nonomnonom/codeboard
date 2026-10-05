# Render several frames from one snapshot

Create a render session when exporting or comparing several frames from the same artwork. Recreate the session after making a revision.

## Reuse a frozen render source

For repeated frames, create `createShotRenderSession(animation)` or `createEditorialRenderSession(sequence, animations)` once. The session validates and copies its inputs during creation. Subsequent edits to the original values do not affect it; create another session for the new revision. Both provide `durationFrames`, rational `frameRate`, `frame(number)` returning a canvas, and `png(number)` returning a promise of PNG bytes. Callers own returned canvases and should reset their 2D context after use; `png()` handles canvas cleanup internally. Returned metadata is separate from the private snapshot.

Artwork-cache surfaces, camera-composition surfaces and review-sheet canvases use the shared 32 megapixel surface validator. Nonpositive, fractional or unsafe dimensions report `INVALID_ARGUMENT` with `details.reason: 'INVALID_SURFACE_DIMENSIONS'`; area overflow reports `RESOURCE_LIMIT` with `reason: 'SURFACE_PIXEL_LIMIT'`. Both include width, height and maxPixels. Numerical overflow during artwork-bound calculation reports `RESOURCE_LIMIT`, `reason: 'ARTWORK_BOUNDS_RANGE'` and layerId instead of treating the artwork as empty. These are per-surface checks, not a cap on total render memory. `createRenderSession` accepts a nonnegative safe-integer `maxCacheBytes`; zero disables retained artwork caching. Invalid cache budgets report `INVALID_ARGUMENT` with `reason: 'INVALID_CACHE_BUDGET'`.

```ts
const session = createEditorialRenderSession(sequence, animations);
await writeFile('frame-24.png', await session.png(24));
const mapping = session.resolve(24);
```

Editorial sessions additionally expose `resolve(frame)` with the same source mapping as `resolveEditorialFrame`. The resolver uses precomputed rational conversion and binary search over validated clip starts. `createEditorialResolver(sequence, animations)` supplies the same isolated mapping and duration without initializing canvas rendering. Resolution is independent of call order. All transitions in a render session must have matching source dimensions, even if a particular frame request does not touch them; cuts may change dimensions. Sessions hold their copied artwork in memory and do not constitute a persisted cache, render queue or memory-budget guarantee.
