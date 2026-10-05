# Bend artwork along a curve

Use a cubic ribbon for an arm, tail or strip of artwork. Choose a live curve for editable controls or bake vertex keys for a fixed mesh track.

<!-- study:mesh-warp:start -->
**Bend the artwork.** Can an image bend without redrawing its contents?

[![Follow the colored surface across the three poses. Its internal marks travel with the deformation.](../../website/public/art/guides/mesh-warp.png)](../../website/public/art/guides/mesh-warp.png)

Follow the colored surface across the three poses. Its internal marks travel with the deformation. A mesh moves the surface and the artwork together. The technical report also exercises copying and merging; the main comparison isolates the bend.

<!-- study:mesh-warp:end -->

## Bake a cubic curve ribbon

`bakeCurveMesh({ rest, segments, keyframes })` returns a `MeshAnimation` for `layer.mesh`.
Each rest/key pose supplies `curve: [start, handle1, handle2, end]` and a positive `width`;
keys also supply signed `frame` and `easing`. All coordinates are layer-local. Keep this
recipe in authoring source and rebake after control-point changes.

The baker samples the existing cubic curve implementation at equal parameter intervals,
offsets each center along its unit normal by half the width, and joins adjacent pairs with
two triangles. `segments` defaults to 32 and accepts 1–2048, subject to the mesh track's
262144-position budget. Increasing segments refines the ribbon approximation; it does not
provide arc-length parameterization, exact curved boundaries or a quality guarantee.

Sampled zero/nonfinite tangents reject with `CURVE_MESH_TANGENT`; ordinary mesh validation
rejects collapsed/inverted faces and bad key order. Global intersections and cusps between
samples are not proved absent. The returned track interpolates baked vertices between keys,
not Bézier control points and normals each frame. Artwork outside the sampled rest ribbon is
omitted. This is a curve-to-mesh authoring operation; curve chains and arbitrary envelope cages are unsupported.

`createCurveMeshEvaluator(recipe)` prepares a private track and returns a function accepting
one signed safe frame. It interpolates all four control points and width using the outgoing
key's easing, then resamples centers and normals and validates the resulting mesh. The return
value has detached `source`, `destination` and indexed `triangles`. No keys uses the rest pose;
nearest keys extend beyond the keyed range. Evaluation is independent of previous requests.

This differs from `bakeCurveMesh` between keys: it samples the interpolated curve instead of
interpolating already-sampled vertices. A valid pair of endpoint curves can still produce an
invalid in-between ribbon; evaluation rejects that frame with diagnostics. Persisted
`layer.curve` bindings now use this evaluator directly. `layer.mesh` continues to interpolate
vertex tracks.

## Persist a live curve binding

```ts
project.editShotAnimation(animationId, [{
  op: 'layer.curve', layerId, curve: recipe,
}]);
```

Use a `CurveMeshInput` recipe as described in the preceding section. The shot's `meshes` collection accepts
exactly one `{ layerId, mesh }`, `{ layerId, curve }` or `{ layerId, envelope }` record per layer.
Supplying multiple representations rejects. `layer.curve` replaces the layer's existing binding; any binding
edit with a null value clears it. There is no implicit composition of two deformers on one
layer: use nested groups for composition. Use `layer.curve.key.put` with a complete
`{ frame, curve, width, easing }` key, or `layer.curve.key.remove` with a signed `frame`.
Frame identity, replacement, missing-key rejection and empty-track rest behavior match mesh
key edits. Rest controls and subdivision count remain unchanged. Moving a key requires remove
and put in one batch. Vertex key operations require a vertex mesh; curve key operations require
a curve binding. A mismatched operation rejects with `MESH_BINDING_KIND`.

Normal plan encoding, studio persistence and subtree-lock comparison retain the curve record.
Older strict shot readers reject it. Shot/editorial rendering prepares the live evaluator;
`shotPointCoordinates` and frame-based `shotMeshData` use that same evaluator. Affine
`shotCoordinates` rejects curve ancestry just as it rejects vertex mesh ancestry.

Inspection includes `bindingKind`, `curveRest` and `curveSegments` (null for vertex meshes).
Curve key pages contain four control points and width in addition to frame/easing; vertex
mesh key pages retain metadata only. Vertex and triangle pages describe the sampled ribbon,
not its four authoring controls. Masks retain the existing deformed-ancestor restrictions.
