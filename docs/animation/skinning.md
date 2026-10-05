# Attach artwork to animated joints

Use skin weights to let several joints influence one mesh. You supply the mesh and weights; inspect bends for collapsed or inverted triangles.

<!-- study:skin-weights:start -->
**Share a bend between two joints.** Which part of the strip follows each joint?

[![The left edge stays fixed, the right edge rises, and the middle moves halfway.](../../website/public/art/guides/skin-weights.png)](../../website/public/art/guides/skin-weights.png)

The left edge stays fixed, the right edge rises, and the middle moves halfway. Explicit weights combine joint motion at each mesh vertex. No weights are generated automatically.

<!-- study:skin-weights:end -->

## Skin vertices with explicit joint weights

`createSkinMeshEvaluator({ source, triangles, joints, weights })` snapshots a skin definition
and returns a function accepting joint poses. Each joint is `{ id, bind }`; each pose is
`{ jointId, matrix }`. Both affine matrices map joint-local coordinates into the mesh's local
space. Each source vertex has 1–8 `{ jointId, weight }` influences. Joint IDs are local to
this definition, not references to project layers.

The evaluator computes `pose × inverse(bind)` per joint and blends the transformed source
vertex using its weights. It supports at most 256 joints and the existing mesh geometry
limits. Bind matrices must be safely invertible. Every vertex requires distinct existing
joint IDs and positive weights summing to one within 64 machine epsilons; accepted rounding
residue is normalized. Each evaluation must supply every joint exactly once. Invalid bind,
weights or pose references reject with `SKIN_*` details. The resulting mesh is validated for
finite geometry, degeneracy and winding reversal before return.

The returned `source`, `destination` and `triangles` are detached and use the mesh coordinate
contract. Use `destination` as a `layer.mesh.key.put` pose to bake a standalone result,
or use the live layer binding in the next section. Automatic weight generation is not provided; supply weights explicitly. Linear blend skinning can collapse or fold geometry under some poses; those
poses reject rather than silently disabling validation.

## Drive a skin from animated layer joints

`layer.skin` persists `LayerSkinInput`: the same source, triangles, joints and weights plus
`jointLayers: [{ jointId, layerId }]`. Map every local joint exactly once to an existing layer
in the same shot. Group layers work as a skeleton hierarchy; animate them with ordinary
`layer.pose` or layer key edits. Joint bind matrices map joint-local coordinates into mesh-local
coordinates at the intended rest pose. Supply those matrices explicitly or capture them with `layer.skin.bind.capture` below.
Binding does not overwrite joint keys.

```ts
project.editShotAnimation(animationId, [{
  op: 'layer.skin', layerId: meshLayerId,
  skin: {
    source: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }],
    triangles: [[0, 1, 2]],
    joints: [{ id: 'root', bind: [1, 0, 0, 1, 0, 0] }],
    weights: Array.from({ length: 3 }, () => [{ jointId: 'root', weight: 1 }]),
    jointLayers: [{ jointId: 'root', layerId: rootJointLayerId }],
  },
}]);
```

The example bind assumes coincident mesh/joint local spaces at rest. At each requested frame,
the evaluator composes the existing layer transforms and pivots, converts each joint pose into
the mesh's local space, then applies weighted skinning. Camera, depth and visibility do not
change joint poses; skin coordinates are pre-camera. Shared ancestors act after skinning and
cancel from the relative transform, including shared deformed ancestors. A nonshared deformed
ancestor or a joint inside the skinned layer rejects with `SKIN_DEFORMATION_BOUNDARY`.
Noninvertible mesh-relative transforms reject at evaluation with `SKIN_LAYER_TRANSFORM` and
joint/frame context. Per-frame mesh validation still rejects collapse or winding reversal.

A layer has one binding: skin replaces its previous mesh/curve/envelope binding. `skin: null`
clears it. Removing a referenced joint requires clearing or repairing its bindings in the same
edit batch. Foreign layer locks protect owned layer data and bindings; they do not freeze
upstream joint motion. `layer.deformation.rest.apply` rejects skins with
`SKIN_REST_REQUIRES_JOINT_KEYS`: restore the actual joint keys explicitly, preserving their
normal IDs and locking semantics.

`shotMeshData` supports paged `joints` (bind matrix and mapped layer ID) and `weights`
(vertex index and influences), also available through `mesh-data --kind joints|weights`.
Non-skin bindings return empty pages for these collections. Skin `keyframes` is empty because
animation belongs to its joint layers. Vertex queries without a frame return bind vertices;
frame queries, point mapping and rendering share live evaluation. Pagination and byte limits
are unchanged.

## Capture a skin bind pose

```ts
project.editShotAnimation(animationId, [{
  op: 'layer.skin.bind.capture', layerId: meshLayerId, frame: 0,
}]);
```

This replaces each existing skin joint's bind matrix with its evaluated mesh-local transform
at the signed local frame. It uses exactly the same hierarchy, pivot and deformation-boundary
resolution as live skin evaluation. Existing source vertices, topology, weights, mappings and
joint animation keys stay intact. The captured frame becomes the identity skin deformation
(up to floating-point precision), relative to the unchanged source vertices. This operation
**rebinds** the animation: other frames can change appearance. It does not bake the current
visible deformation into a new source mesh or restore a joint pose.

Use it after creating/moving joint layers, including earlier edits in the same batch. A batch
can put a skin with invertible provisional binds and then capture the intended rest frame.
Missing/wrong bindings, dangling mappings, deformation crossings and unsafe transform inverses
reject. Final shot validation also rejects singular captured joint binds. Capture changes the
skin binding owned by the mesh layer, so normal layer locks, transaction rollback, plan CAS and
receipts apply. Later joint edits do not silently recapture bind matrices.

## Revise skin weights without replacing the binding

```ts
project.editShotAnimation(animationId, [{
  op: 'layer.skin.weights.put', layerId: meshLayerId, vertexIndex: 2,
  influences: [
    { jointId: 'tip', weight: 0.6 },
    { jointId: 'root', weight: 0.4 },
  ],
}]);
```

This replaces the complete influence list for one zero-based source vertex. Each list contains
1–8 distinct existing joints, positive finite weights, and a total of one within the same
rounding tolerance as full skin binding. Omit a joint to remove its influence; zero weights and
empty lists reject. The operation does not normalize arbitrary totals or infer missing weights.
An out-of-range source vertex rejects with `SKIN_WEIGHT_VERTEX`; a non-skin binding rejects
with `MESH_BINDING_KIND`.

Use multiple edits in one `animation.edit` batch to revise several vertices atomically.
Repeated edits to the same vertex follow batch order. Final shot validation checks the resulting
binding before installation; source geometry, topology, bind matrices, joint mappings and
unaddressed weights remain unchanged. Normal layer locks and saved-plan version checks still
apply. Read the paged `weights` collection to prepare a correction. Vertex indices refer to the
current topology, so use version-pinned saved plans when applying agent corrections.

Live skin pose resolution reuses evaluated local layer transforms and relative path matrices
within each frame request. Mesh inverses are shared by joints with the same cancelled ancestor
prefix. All such caches are local to that request; bind capture uses the same resolver. There
is no previous-frame state or cross-frame geometry cache. Runtime seek parity and production
performance still require measurement.
