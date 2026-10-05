# Animate with named pose controls

Create a named control such as Bend or Lean and animate its influence. Controllers work over existing layer keys, which remain editable.

<!-- study:controller-exchange:start -->
**Read a gesture across four shots.** Can you follow who offers and who receives the card?

[![Watch the yellow card and the two hands: notice, offer, receive, then hold. Use the stills to compare each pose.](../../website/public/art/guides/controller-exchange.png)](../../website/public/art/guides/controller-exchange.png)

Watch the yellow card and the two hands: notice, offer, receive, then hold. Use the stills to compare each pose. The sequence combines arm bends, position controls and held mouth drawings. The card path and mouth cues are authored explicitly.

<!-- study:controller-exchange:end -->

## Named live pose controllers

A shot can store up to 64 `ShotController` records. Each named controller drives up to 256
explicit target layers through one animated weight. Controllers evaluate after ordinary layer
keys in their saved array order; they preserve those base keys. The resulting transform,
opacity and depth feed rendering, affine/mesh point queries and joint skin evaluation.

```ts
project.editShotAnimation(animationId, [{
  op: 'controller.put',
  controller: {
    id: 'controller:bend', name: 'Bend', mode: 'additive', weight: 0,
    targets: [
      { layerId: elbowLayerId, values: { rotation: 0.18 } },
      { layerId: faceLayerId, values: { opacity: -0.1 } },
    ],
    keyframes: [
      { frame: 0, weight: 0, easing: 'ease-in-out' },
      { frame: 12, weight: 1, easing: 'ease-in-out' },
      { frame: 23, weight: 0, easing: 'linear' },
    ],
  },
}]);
```

`replace` blends each addressed channel from its current evaluated value toward the target;
`additive` adds weight times the supplied channel offset. Scale offsets are arithmetic, not
multipliers. Channels are x, y, scaleX, scaleY, rotation (radians), opacity and depth. Unspecified
channels retain their current value. Weight zero has no effect. Weights lie in [0,1]; ordered
unique signed frame keys use existing easing and nearest-key extension, with at most 4096 keys.
The controller's static weight is used only when it has no keys. Layer transforms and targets
are local to each layer's parent space, not world-space constraints.

Updating the same ID replaces its definition in place, preserving stack order. New IDs append;
`{ op: 'controller.remove', id }` removes one and reveals the unchanged base animation where
no other controller acts. `controller.move` explicitly reorders the stack.
Targets must be distinct existing layers per controller; IDs are globally checked by the project.
Layer deletion must repair/remove referencing controllers in the same batch. Object discovery
includes `shot-controller` metadata; complete definitions are in the shot snapshot. Saved plans
and ordinary undo/redo/receipts use the existing shot persistence path.

Foreign layer locks protect every controller touching a locked layer or its descendants,
including its weight, other targets and relative stack order. Controller evaluation rejects
nonfinite results, opacity outside [0,1], or nonpositive depth instead of silently clamping.
Geometry validation still decides whether a controlled skin pose folds or collapses. Controller
parameters cannot reference other controllers, so there is no expression graph or cycle solver.
Controllers do not select drawings, evaluate arbitrary functions or interpolate multidimensional poses. Use [controller performance files](performance-files.md) to transfer numeric controller motion with explicit mappings.

## Edit controller weights, keys and order

```ts
project.editShotAnimation(animationId, [
  { op: 'controller.weight', id: 'controller:bend', weight: 0.25 },
  { op: 'controller.key.put', id: 'controller:bend',
    key: { frame: 12, weight: 0.8, easing: 'ease-in-out' } },
  { op: 'controller.move', id: 'controller:bend', beforeId: null },
]);
```

`controller.weight` changes the static fallback; an existing key track continues to take
precedence. `controller.key.put` inserts or replaces the key at its signed frame and keeps
keys sorted. `controller.key.remove` takes `id` and `frame`, rejecting missing keys. Removing
the final key restores static-weight evaluation. Key edits preserve the name, targets, mode,
static weight and stack position.

`controller.move` places the named controller before `beforeId`; null means the end of the
stack. Moving before itself is a no-op. Missing controllers and insertion targets reject.
Order matters when multiple controllers affect the same channel, especially replace blends.
All these edits run on the isolated shot draft and use the same final validation, lock and
transaction paths as definition replacement. Errors include `CONTROLLER_MISSING`,
`CONTROLLER_KEY_MISSING` or `CONTROLLER_MOVE_TARGET` details.

## Inspect a controller in bounded pages

`shotControllerData(animation, controllerId, query)` and
`project.shotControllerData(animationId, controllerId, query)` return detached pages.
The query collection is `targets` or `keyframes` (default), with `offset`, `limit` and an
optional signed `frame`. Default page size is 50, capped at 200; the existing 256 KiB response
limit rejects oversized pages rather than truncating records.

Every page includes the controller name/mode, its zero-based stack index, static weight,
target/key counts and `nextOffset`. With a frame, `evaluatedWeight` uses the same weight evaluator
as rendering. Target items then include `evaluatedState`: the layer's final local transform,
opacity and depth after base keys and **all** controllers in stack order, not just the selected
controller. It is not a world-space matrix or deformed geometry. Without a frame, evaluated
fields are null. Key pages retain the authored easing and weights.

Input shot validation still examines the complete snapshot; pagination bounds output, not
validation cost. Missing controllers and malformed queries reject. `nextOffset` is not a
snapshot/version token: pin the saved version when collecting multiple CLI pages or preparing
an edit plan.
