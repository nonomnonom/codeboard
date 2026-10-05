# Correct a drawing hold

Replace a mouth, hand or other drawing for a frame range while retaining the surrounding exposures.

<!-- study:drawing-holds:start -->
**Hold, change and leave a blank.** What is visible between drawing keys?

[![The open eye holds, the closed eye replaces it, then the explicitly blank exposure removes it.](../../website/public/art/guides/drawing-holds.png)](../../website/public/art/guides/drawing-holds.png)

The open eye holds, the closed eye replaces it, then the explicitly blank exposure removes it. A drawing key holds until the next key; a blank exposure is an authored state.

<!-- study:drawing-holds:end -->

<!-- study:drawing-timing:start -->
**Swap the drawing while it moves.** Does a drawing change have to interrupt movement?

[![Compare frames 11 and 12. The triangle becomes a diamond immediately, while its travel to the right continues.](../../website/public/art/guides/drawing-timing.png)](../../website/public/art/guides/drawing-timing.png)

Compare frames 11 and 12. The triangle becomes a diamond immediately, while its travel to the right continues. Drawing holds choose the silhouette. Position keys move the whole drawing independently.

<!-- study:drawing-timing:end -->

## Replace one shot drawing hold

Use `layer.drawing.range` for a local correction without reconstructing the entire sequence:

```ts
project.editShotAnimation('walk-shot', [{
  op: 'layer.drawing.range',
  layerId: 'mouth-track',
  startFrame: 10,
  endFrame: 14,
  drawingId: 'mouth-closed',
}]);
```

The target must already be a drawing-sequence group; initialize it with `layer.drawings` when needed. The edit replaces exposure keys within `[10, 14)` and restores the prior sequence's drawing at frame 14. An existing key at the end boundary remains. Use `drawingId: null` for a blank hold. Signed local frames permit preroll; the range must be nonempty and its endpoints safe integers. Keys outside the range remain, including repeated drawings; the operation does not compact the sequence.

The final shot validator checks child drawing references and drawing-group constraints. Within one edit batch, define any new referenced drawing before final validation. The edit is also accepted by `animation.edit` plans. Board `production.setDrawingRange` shares the replacement algorithm and keeps its global nonnegative frame contract.

`project.production.drawingNeighbors(groupId, frame, { skipBlank: true })` accepts board or shot-animation drawing group IDs. Board queries use global panel frames; shot queries use local frames in `[0, durationFrames)`. Results contain at most current/previous/next drawing intervals, clipped to the owning panel or shot, without returning artwork. Preroll keys determine the shot's initial exposure; querying outside its output duration rejects. `skipBlank` skips blank neighboring intervals while retaining a blank current interval. Consecutive keys referencing the same drawing form one hold in this read view.
