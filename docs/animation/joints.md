# Pose a two-bone rig

Use an upper and lower joint for an arm or leg. Create the rig and its artwork before posing it; [geometry helpers](../drawing/geometry.md#solve-a-two-bone-reach) show a complete board example.

<!-- study:pivots:start -->
**Choose where rotation happens.** Why does the same angle move an object differently?

[![Follow the cross marking the rotation center as the plank turns.](../../website/public/art/guides/pivots.png)](../../website/public/art/guides/pivots.png)

Follow the cross marking the rotation center as the plank turns. The pivot determines the point around which the layer rotates.

<!-- study:pivots:end -->

## Pose a local two-bone rig

Add `layer.rig.pose` to a shot animation edit batch:

```js
project.editShotAnimation('animation:greeting', [{
  op: 'layer.rig.pose', layerId: 'rig:arm', frame: 24,
  target: { x: 180, y: 80 }, bend: 1, easing: 'ease-in-out',
  rootKeyId: 'key:arm-24', elbowKeyId: 'key:elbow-24',
  unreachable: 'reject',
}]);
```

The target is in the rig root parent's coordinate space, not camera/output space. The operation evaluates current joint transforms at the signed local frame, solves the existing two-bone rig, and writes sparse rotation keys for root and elbow. It retains other keyed channels and per-channel easing, selects the nearest equivalent rotations and applies the supplied easing to rotation only (default linear). Existing keys at that frame must use their existing IDs; a key ID belonging to another frame rejects rather than moving it. New IDs must be globally unique.

Choose `unreachable: 'reject'` for an atomic failure outside the rig's reachable range, or `'clamp'` to pose at its reachable boundary. The choice is required for shot edits. Board `production.poseTwoBoneRig` and board `rig.pose` plans accept the same policy optionally, defaulting to the existing clamp behavior. Existing unit-scale, origin-pivot and fixed-elbow-offset constraints remain enforced. Foreign joint/ancestor locks reject at the project boundary. Board rig posing retains its existing nonnegative-frame and generated-ID behavior, using the same pose preparation algorithm. This adds local two-bone posing, not mesh/envelope deformation or generalized constraints.

Two-bone domain failures use `CodeboardError` with code `INVALID_ARGUMENT` and a machine-readable `details.reason`. The numerical solver reports `INVALID_IK_INPUT`, `IK_LENGTH_RANGE`, `IK_TARGET_RANGE`, or `IK_RESULT_RANGE`. Structure validation reports `RIG_ELBOW_PARENT`, `RIG_DRAWING_SELECTION`, `RIG_JOINT_TRANSFORM`, or `RIG_ELBOW_OFFSET`, with `rootId` and the relevant `elbowId`/`jointId`. Pose preparation reports `RIG_REACH_POLICY`, `RIG_FRAME`, `RIG_MISSING`, or `RIG_UNREACHABLE`; unreachable rejection retains the solution and adds root/frame context. Board configuration rejects a nongroup root with `RIG_ROOT_KIND`. These diagnostics cover domain checks; schema parsing, lookup and lock failures retain their own error contracts. No solver equations or accepted joint constraints change.

## Capture and restore a two-bone rest pose

A configured shot rig can store an explicit rest pose without changing its current keys:

```js
project.editShotAnimation('animation:greeting', [{
  op: 'layer.rig.rest.capture', layerId: 'rig:arm', frame: 0,
}]);
project.editShotAnimation('animation:greeting', [{
  op: 'layer.rig.rest.apply', layerId: 'rig:arm', frame: 48,
  rootKeyId: 'key:arm-rest-48', elbowKeyId: 'key:elbow-rest-48',
  easing: 'ease-in-out',
}]);
```

Capture samples the current batch draft at a signed local frame and replaces `TwoBoneRig.restPose`. It stores root x/y/rotation in the root parent's coordinates and elbow rotation in root coordinates. Ancestor transforms, artwork, opacity, depth, scale and key timing are not captured. Changing the parent later interprets the stored pose in that new parent's coordinates; recapture explicitly when that is not intended.

Apply requires stored rest data (`RIG_REST_MISSING` otherwise). It authors root x/y/rotation and elbow rotation as ordinary keys, preserving other channels and their easing. Supplied easing affects only restored channels; omitted easing retains existing per-channel behavior. Existing keys at the destination frame require their existing IDs. Both keys are prepared before publication; final shot/project checks still reject identity collisions, invalid rigs and locked edits. Use the same operations inside an `animation.edit` plan and retry the exact saved plan/request pair.

Rest data is optional and persists with the rig through normal project saves and identity-remapped copies. Rig definitions without it retain existing behavior. Redefining the rig without `restPose` clears the saved rest. Runtimes predating this strict schema field reject such rig definitions; keep an original copy when handing work to an older runtime. This feature restores a cut-out joint pose; curve, envelope and weighted skin deformation use the separate [mesh and skin bindings](rigging.md).

## Convert a canvas target for shot IK

`project.shotCoordinates(animationId, targetId, {frame, camera})` returns the geometric transforms for a layer or drawing element. The standalone `shotCoordinates(animation, targetId, options)` validates and copies its animation input. Frame defaults to local zero and accepts signed safe integers for preroll; camera defaults to enabled. `camera: false` omits the camera plane transform.

```js
import {transformPoint} from 'codeboard-studio';

const space = project.shotCoordinates('animation:greeting', 'rig:arm', {frame: 24});
if (!space.frameToParent) throw new Error('Rig parent transform cannot be inverted');
const target = transformPoint(space.frameToParent, {x: 480, y: 270});
project.editShotAnimation('animation:greeting', [{
  op: 'layer.rig.pose', layerId: 'rig:arm', frame: 24, target,
  rootKeyId: 'key:arm-24', elbowKeyId: 'key:elbow-24', unreachable: 'reject',
}]);
```

`localToFrame` and `frameToLocal` map the target's own coordinates. `parentToFrame` and `frameToParent` map its parent's coordinates: the containing group for a layer, or containing drawing layer for an element. Root layers use the camera plane as their parent mapping, including animated depth. Transforms include ancestor pivots and animation; element matrices apply only to local mapping. Singular or unstable inverses return `null`; forward transforms remain available. This is geometry inspection, independent of visibility, exposure, masks or pixel coverage, and does not descend into component definitions. The existing `production.coordinates` board query uses the same kernel and now also returns parent transforms; its frames remain nonnegative and global.
