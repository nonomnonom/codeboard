# Visual examples you can run

These studies isolate one behavior at a time. Their images are rendered with Codeboard's public API. The audio and hierarchy figures are explanatory diagrams drawn with that API; they are not screenshots of an editor or an audio waveform.

## Run all eight studies

Install [Codeboard from npm](install.md), download [documentation.mjs](https://codeboard.nonom.xyz/art/guides/documentation.mjs), and save it in an artwork folder:

```sh
codeboard run documentation.mjs
```

The repository and offline plugin bundle also include the [study source](../examples/documentation.mjs).

For a local dependency, use `npx codeboard run documentation.mjs`. The script creates eight PNGs and eight editable `.cboard` projects under `output/documentation`. It replaces those named outputs when rerun; keep independently edited copies elsewhere. No input artwork, audio file or FFmpeg is required. Labels use the host's sans-serif font.

Pass a different output folder as the first script argument:

```sh
codeboard run documentation.mjs output/studies
```

## Choose an editing representation

![A textured replayable stroke, a smooth vector stroke, and a low-resolution pixel triangle](https://codeboard.nonom.xyz/art/guides/representations.png)

The first two samples use the same pen path. The brush interprets samples through its tip and texture; the vector stroke creates a smooth contour. The third sample is a 32 × 24 pixel image enlarged eight times. It retains pixels, not a vector outline. See [drawing](drawing.md).

## Clip to the layer below

![Silhouette alone, highlights extending outside it, and the same highlights clipped to the silhouette](https://codeboard.nonom.xyz/art/guides/clipping.png)

Only `clipToBelow` changes between the second and third panels. The highlight layer follows the silhouette in the same sibling stack. See [layers and composition](layers.md).

## Feather a pixel selection

![The same triangle filled through a hard selection and a selection feathered by eight source pixels](https://codeboard.nonom.xyz/art/guides/selections.png)

The selection outline and fill color stay the same. Feathering softens selection coverage before the fill; it does not change the vector shape or layer opacity. See [pixel selections](pixels.md).

## Place a reusable component

![Three lamp instances at scales 1, 0.7 and 1.3](https://codeboard.nonom.xyz/art/guides/components.png)

All three lamps originate from one captured group. Each placed instance has its own artwork IDs. Source revisions reach an existing instance only through an explicit refresh. See [components](components.md).

## Separate a drawing change from movement

![Six frames showing a triangle moving right and switching to a diamond at frame 12 while movement continues](https://codeboard.nonom.xyz/art/guides/drawing-timing.png)

The drawing switches at frame 12. Position interpolates independently from frame 0 to 23. Compare frames 11 and 12: the new silhouette appears immediately rather than morphing. See [animation](animation.md).

## Inspect IK reachability

![Two arm targets reached by articulated segments and a third target beyond the arm's maximum reach](https://codeboard.nonom.xyz/art/guides/ik-reach.png)

Crosses mark targets. Segment lengths remain 100 and 80 units. The third target is farther than the combined reach; the API returns `reachable: false`. See [two-bone IK](math.md#solve-a-two-bone-reach).

## Distinguish audio trim and placement

![Source audio from second 1 to 4 mapped to project seconds 2 to 5 at 24 fps](https://codeboard.nonom.xyz/art/guides/audio-placement.png)

This diagram explains the units in [audio](audio.md). The source trim and project position use separate fields. The diagram itself contains no sound.

## Understand ownership

![Hierarchy from project through scene, shot, panel and layer to an individual element, with each level's responsibility](https://codeboard.nonom.xyz/art/guides/hierarchy.png)

Read [project concepts](concepts.md) for creation calls, stable IDs and revision ownership. Groups and layers are represented at one level here for readability; groups can nest.
