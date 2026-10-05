# Read timeline metadata

Read small pages of timing data when locating a shot, camera key or linked panel. Keep one saved version while collecting multiple pages.

## Inspect studio timing without copying artwork

Use `project.editorialClips(sequenceId, {offset, limit})` to read clip source ranges and transitions in editorial order. `project.production.cameraKeyframes(animationId, {offset, limit})` accepts a shot-animation ID as well as a board-shot ID; animation keys retain signed local frame positions. Existing `production.layerKeyframes(layerId, options)` and rig/drawing-sequence reads already accept studio layer IDs.

Paged caption, timing, audit and audio detail responses reject serialized output above 256 KiB with `RESOURCE_LIMIT`. Reduce the page limit or narrow the request; detail text is not silently truncated. This limit complements the existing 50-record default/200-record maximum. Explicit whole-document/artwork reads remain bulk APIs.
