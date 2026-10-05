# Deform a patch with an envelope

Shape a rectangular patch with four cubic boundaries. Keep the corner coordinates shared so the patch remains connected.

<!-- study:envelope:start -->
**Bend a surface from its boundary.** Can the border control the shape inside?

[![The woven grid follows the curved upper and lower edges. The side endpoints stay fixed.](../../website/public/art/guides/envelope.png)](../../website/public/art/guides/envelope.png)

The woven grid follows the curved upper and lower edges. The side endpoints stay fixed. An authored envelope generates a mesh that deforms the interior artwork.

<!-- study:envelope:end -->

## Bake a four-boundary envelope

`bakeEnvelopeMesh({ rest, columns, rows, keyframes })` returns a regular indexed mesh track.
Each pose contains four cubic tuples: `top`, `bottom`, `left`, `right`. Top and bottom run
left-to-right; left and right run top-to-bottom. Their shared endpoints must match exactly.
Keys contain `{ frame, pose, easing }` and use ordered signed local frames.

The baker samples a bilinearly blended Coons patch: it combines opposite boundary blends
and subtracts the bilinear corner blend. Sampled edge vertices retain boundary coordinates.
The grid defaults to 8 columns and 8 rows; subdivisions accept positive integers, with at
most 4096 triangles and 262144 stored positions across rest and keys. Invalid corners reject
with `ENVELOPE_CORNERS`; collapsed/inverted triangles use the shared mesh diagnostics.

Use the result in `layer.mesh`, retaining the envelope recipe in authoring source. Interpolation is
between baked vertices; this operation does not persist live envelope controls. It covers
four-boundary patches, not arbitrary closed contour cages, automatic binding or global
intersection prevention.

## Persist an editable envelope

Use `layer.envelope` with `{ layerId, envelope: recipe }` to retain the boundary controls,
rest pose and grid in the shot. `envelope: null` clears the layer's binding. The recipe is an
`EnvelopeMeshInput`; it uses the same strict corner, geometry and budget checks as baking.
`layer.envelope.key.put` accepts a complete `{ frame, pose, easing }` key;
`layer.envelope.key.remove` requires an existing signed frame. The shared draft owner preserves
rest/grid and other keys, rejects wrong binding types, and validates the final shot.

The renderer prepares vertex keys from the saved controls. A fixed-grid Coons surface is
linear in its boundary control coordinates, so interpolation of these prepared positions
represents interpolation of the controls with the same easing (subject to floating-point
rounding). Unlike a curve ribbon, it has no normalized tangent that must be recalculated.
Each evaluated mesh is still checked for degeneracy/foldover; valid endpoints do not prove
all in-between frames valid.

Rendering, point mapping and frame vertex inspection share the binding evaluator.
`shotMeshData` reports `bindingKind: 'envelope'`, `envelopeRest`, `envelopeGrid`, and bounded
key pages with boundary poses; the two envelope metadata fields are null for other bindings.
The existing one-binding-per-layer, nested-group composition, lock and mask-boundary rules
apply. Older strict readers reject envelope records.
