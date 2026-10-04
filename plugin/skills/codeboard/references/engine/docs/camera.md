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

![Original framing of the demo takeoff pose](https://codeboard.nonom.xyz/art/code-board-demo/camera-wide.png)

![The same frame with a closer camera and corrected pan](https://codeboard.nonom.xyz/art/code-board-demo/camera-close.png)

These images show the same drawing at frame 128. Only the camera changes. In the [downloadable example](code-board-demo.md), the shot ID is `hop`:

```js
project.production.addCameraKeyframe('hop', 128, {
  x: 60, y: 160, zoom: 2, rotation: 0,
});
```

Positive camera X moves the viewing position right, so artwork moves left in the frame; positive Y moves the viewing position down. Zoom is centered on the frame after pan. Zoom and root-plane depth must be positive.

```js
project.production.updateCameraKeyframe(shot.id, endKey, { zoom: 1.6 });
console.log(project.production.cameraKeyframes(shot.id, { limit: 20 }));
```

Use `removeCameraKeyframe(shotId, keyId)` to delete a key. X, Y, zoom, and rotation interpolate independently, using the same easing choices as [layer animation](animation.md).

To remove only zoom from a mixed camera key, use `removeCameraKeyframeChannels(shotId, keyId, ['zoom'])`. Other channels on that key remain. Keys at the same frame merge supplied channels. A channel holds its nearest value before its first key and after its last key; unkeyed channels keep the default framing.

## Build depth

Give root layers different positive `depth` values to produce multiplane parallax when the camera moves. Depth 1 is the default plane; smaller values respond more strongly to camera movement and larger values less strongly. Keep foreground, character, and background artwork on separate root planes. A group's children remain on the group's plane.

```js
const foreground = panel.addGroup('Foreground', { depth: .7 });
const background = panel.addGroup('Background', { depth: 2 });
```

Multiplane depth changes camera projection; it does not turn flat artwork into a 3D model. Render the start, middle, and end of a move to check framing and overlaps.

Use `production.setPlaneDepth(layerId, depth)` to change a plane later, or a layer key's `depth` channel to animate it. Projection uses pan divided by depth and zoom raised to `1 / depth`. Root layer order still controls overlap. Depth does not reorder layers or create perspective geometry.

## Evaluate without playback

```js
import { evaluateCamera } from 'codeboard-studio';
const keys = project.production.cameraKeyframes('hop', { limit: 100 });
console.log(evaluateCamera(keys, 128));
```

Pass the full set of relevant keys when evaluating, including keys bracketing the requested frame. A truncated query can give a different interpolation result. Rendering a project evaluates its complete timeline automatically.

## Framing guides and isolated artwork

```js
import { renderPanelPNG, renderCompositionGuides } from 'codeboard-studio';
import { writeFile } from 'node:fs/promises';
await writeFile('source-pose.png', await renderPanelPNG(project, 'performance', {
  frame: 128, camera: false, annotations: false, layerIds: ['clawd'],
}));
await writeFile('guides.png', await renderCompositionGuides(project, 'performance', {
  frame: 128, thirds: true, safeInset: .08, horizonY: 800,
  vanishingPoints: [{ x: 960, y: 400 }],
}));
```

Guides are review overlays; they do not modify the document. Horizon and vanishing-point positions are output-frame coordinates. `safeInset` is a fractional inset on each edge, not a named broadcast-safe standard. Layer isolation respects its hierarchy; a hidden ancestor can still hide the selected artwork.

## Inspect a camera frame

```js
import { renderFramePNG } from 'codeboard-studio';
import { writeFile } from 'node:fs/promises';
await writeFile('camera-check.png', await renderFramePNG(project, 36));
```

Frame rendering evaluates both the camera and artwork animation. A panel drawing and a camera-framed timeline image serve different review tasks; use exact frame renders for timing decisions.
