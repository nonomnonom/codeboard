# Independent PSD writer fixtures

These locally authored files were generated with `ag-psd@31.0.2`, using
`writePsdBuffer(document, { noBackground: true })`; `layered-zip.psd` additionally
sets `compress: true`. The writer is fixture tooling, not an engine dependency.
The source document has a 4×4 white pixel layer (ID 7, `Paper`), then a normal
isolated group (ID 14, `Paint é`, opacity 128/255) containing a 2×2 opaque red
pixel layer at (1,1) (ID 10, `Red`). All other visibility and opacity values use
the writer's normal defaults. Image data uses Uint8ClampedArray RGBA samples.

The deliberately plain-white 4×4 merged preview does not include the red group.
Tests require the imported native layers to render the group; consuming the
merged preview instead would fail. RLE and ZIP imports must have identical
editable layer data. Original PSD numeric layer IDs are namespaced on import.

`unsupported-effect.psd` instead contains a red layer with an enabled black drop
shadow (4-pixel size, 2-pixel distance, 90 degrees, opacity 1).
`clipping.psd` contains a red layer with clipping enabled above the white layer.
Both must reject even when metadata losses are permitted. The writer also emits
link-group metadata (resources 1026/1072); the report records its omission.

The fixture shapes are original test data. This is independent-writer evidence,
not a Photoshop application round trip or evidence for all PSD features.
