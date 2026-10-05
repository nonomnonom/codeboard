---
name: codeboard-draw
description: Use when constructing or correcting Codeboard artwork, including vector contours, replayable paint, pixel selections, masks, layer organization, and reusable static components.
---

# Draw for the next edit

Prerequisite: codeboard session context.

Read `docs/drawing/marks.md` and `docs/drawing/layers.md`. For pixels read `docs/drawing/pixels.md`; for reuse read `docs/drawing/components.md`; for coordinate conversion read `docs/drawing/geometry.md`. Resolve calls in `docs/reference/api/project.md` and `docs/reference/api/drawing.md`.

## Choose the representation

| Needed edit | Representation |
| --- | --- |
| Pressure, texture, later brush adjustment | Replayable raster stroke |
| Contour, fill, boolean geometry | Vector path or vector stroke |
| Imported image, selection, bounded paint correction | Pixel surface |
| Joint placement or several parts moving together | Layer group |

Build a representative silhouette and material at the intended scale. Separate parts according to independent edits, not a fixed layer template. Retain element IDs returned by authoring calls.

For shape feedback, edit source geometry. For placement feedback, transform the selected element or owning layer. For screen-space feedback, obtain the intended frame's coordinate mapping before changing source points. A singular inverse needs resolving, not an estimated offset.

## Composition and pixels

Inspect sibling order and mask dependencies before moving or reparenting layers. A clipping layer needs the preceding sibling's alpha; a mask must belong to the appropriate sibling stack. Reparenting can change placement through its new coordinate hierarchy.

Decode an imported image and place a raster surface; registering an asset alone does not display it. Pixel selections use source resolution. An edit-region callback uses patch-local coordinates. Construct asynchronous feathering before entering a synchronous edit transaction.

Capture components for repeated static artwork. Capture an individual pose rather than a whole drawing track. Refreshing an instance replaces local artwork; use codeboard-revise when that replacement affects saved edits.

## Check the result

Inspect the full composition and a crop at the changed edge. Check silhouette, pressure joins, mask boundaries, and nearby untouched content. Use codeboard-brushes when the mark, rather than its path, is wrong. Use codeboard-review for requested export formats.
