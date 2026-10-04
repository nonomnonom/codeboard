# Two-bone cut-out rigs

A two-bone rig is stored on a group and refers to an immediate child elbow group by stable ID. Artwork beneath those joints can combine vector and raster layers. Posing solves two rigid links, then writes ordinary independent rotation keyframes; the renderer uses the existing hierarchy. It does not deform pixels or paths.

```ts
const shoulder = panel.addGroup('Shoulder', { transform: { x: 200, y: 180 } });
const elbow = panel.addGroup('Elbow', { transform: { x: 90 } }, shoulder.id);
// Author upper-arm artwork along shoulder-local +X, from 0 to 90.
// Author forearm artwork along elbow-local +X, from 0 to 70.
project.production.setTwoBoneRig(shoulder.id, {
  elbowId: elbow.id, upperLength: 90, lowerLength: 70,
});
const result = project.production.poseTwoBoneRig(shoulder.id, 12,
  { x: 310, y: 230 }, { bend: 1, easing: 'ease-in-out' });
console.log(result.reachable, result.error, result.elbow, result.end);
console.log(project.production.twoBoneRig(shoulder.id));
```

The target and returned joint points are in the root group's **parent coordinates**, before parent transforms and the camera. The root's evaluated X/Y at that frame is the shoulder origin. Use [coordinate inspection](agent-workflow.md) to convert a frame-space target into the parent's space. `solveTwoBoneIK(origin, target, upperLength, lowerLength, bend)` exposes the same numeric solver without changing a project.

`bend: 1` selects a positive relative elbow rotation; `-1` selects negative. Angles are radians; positive rotation is clockwise in the canvas's downward-Y coordinates. Pose keys choose an equivalent angle nearest the current evaluated joint angle to avoid an unnecessary full turn. Other keyed properties and their easing remain unchanged. Reposing the same frame updates the same key IDs. Inspect/edit/delete the resulting keys through the ordinary layer-key APIs.

## Reach, interpolation and constraints

The solver preserves both lengths. Targets outside the annulus from `abs(upperLength - lowerLength)` to `upperLength + lowerLength` are projected to its nearest radial boundary. `reachable` reports that limitation and `error` gives the endpoint-to-target distance. At a target exactly on the root, direction defaults to +X; equal links fold back onto the root. Inputs and outputs must be finite. Lengths must be positive, have a finite sum, and their ratio must be at least `Number.EPSILON`; more extreme ratios are rejected as numerically ill-conditioned.

The joint groups require origin pivots and unit local scale. Scale an ancestor instead. The elbow stays at `(upperLength, 0)` and cannot have X/Y or scale keyframes. The root can have position and rotation keys, but no scale keys or drawing-alternative schedule. Shape changes and alternate drawings can live beneath the joints. Unbind with `setTwoBoneRig(rootId, null)` before changing these structural constraints; unbinding leaves existing artwork and rotation keys intact.

A pose is **baked at the authored frame**, not a live target constraint. Between keys, joint angles interpolate with their authored easing; the end effector is not guaranteed to follow a straight target path, stay pinned, or avoid obstacles. To author a constrained sampled path, call the pose API at each required frame and inspect the results. Changing a root position key later does not automatically solve old targets again. Target requests are source-authoring decisions; the saved rig definition, artwork and resulting keys are sufficient to edit and render the accepted pose animation.

This implementation has no stretch, joint-angle limits, stiffness, multi-joint solver, IK nails, skinning, mesh/curve deformation or automatic collision avoidance. Harmony documents those broader [IK setup](https://docs.toonboom.com/help/harmony-24/premium/cut-out-animation/about-ik-setup.html) and [IK tool controls](https://docs.toonboom.com/help/harmony-24/premium/reference/tool-properties/inverse-kinematics-tool-properties.html); the two-link implementation here is a bounded subset.

## Revision and persistence

Rig definitions are group metadata in the editable project. `twoBoneRig(rootId)` reads a copy of just that definition. Pose operations update both joints in one undoable mutation and honor version checks. Invalid target/curve/frame input is rejected before keys or IDs are assigned. Removing or reparenting a referenced elbow requires unbinding; the whole rig can move together. Panel/drawing duplication remaps the stored elbow ID. Save/open and partial-panel loading retain the definition and poses. Retiming moves the ordinary rotation keys; it does not run the solver again.

Generic layer transform/pivot edits and keyframe additions/updates also check affected rig constraints before assigning properties or allocating key IDs. An agent may catch an invalid joint edit inside a transaction and continue with a valid pose; the rejected edit leaves the document unchanged. This check visits layer metadata and does not copy artwork payloads.

Tests verify both bend directions, unreachable inner/outer targets, fixed lengths, actual rendered endpoint position and alpha, stable key IDs, independent opacity, invalid-edit isolation (including caught generic edits within a transaction), undo/redo, partial loading, save/open, retiming and duplicate-panel reference remapping.

## Flagship use

The source in `examples/last-light/legs.ts` authors six articulated brass legs through the public API. The flight shot begins with extended legs and folds them over 12 frames into a held tucked pose. Each rig has two lengths, two group joints and two keyed poses. The existing body path, wing drawings, camera, audio and other panels are unchanged.
