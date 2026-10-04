# Camera

Use camera keys to frame a shot independently of its artwork. Camera X/Y specify pan offsets from the original framing. At X=0, Y=0, and zoom=1, the canvas keeps its original framing. A larger zoom moves closer. Rotation uses radians.

```js
const shot = project.addScene('Street').addShot('Push in');
const panel = shot.addPanel({ durationFrames: 72 });
project.production.addCameraKeyframe(shot.id, 0, {
  x: 0, y: 0, zoom: 1, rotation: 0, easing: 'ease-in-out',
});
const endKey = project.production.addCameraKeyframe(shot.id, 71, {
  x: 70, y: -30, zoom: 1.35,
});
```

The example assumes a 1280×720 project starting at frame 0. For later shots, use their global frame positions.

## Revise the framing

```js
project.production.updateCameraKeyframe(shot.id, endKey, { zoom: 1.6 });
console.log(project.production.cameraKeyframes(shot.id, { limit: 20 }));
```

Use `removeCameraKeyframe(shotId, keyId)` to delete a key. X, Y, zoom, and rotation interpolate independently, using the same easing choices as [layer animation](animation.md).

## Build depth

Give root layers different positive `depth` values to produce multiplane parallax when the camera moves. Depth 1 is the default plane; smaller values respond more strongly to camera movement and larger values less strongly. Keep foreground, character, and background artwork on separate root planes. A group's children remain on the group's plane.

```js
const foreground = panel.addGroup('Foreground', { depth: .7 });
const background = panel.addGroup('Background', { depth: 2 });
```

Multiplane depth changes camera projection; it does not turn flat artwork into a 3D model. Render the start, middle, and end of a move to check framing and overlaps.

## Inspect a camera frame

```js
import { renderFramePNG } from 'codeboard-studio';
import { writeFile } from 'node:fs/promises';
await writeFile('camera-check.png', await renderFramePNG(project, 36));
```

Frame rendering evaluates both the camera and artwork animation. A panel drawing and a camera-framed timeline image serve different review tasks; use exact frame renders for timing decisions.
