# Create and revise a drawing sequence

Build an editable animation directly with the Codeboard API. Create two drawings, select when each appears, move their parent track, save the project, then reopen it for a timing correction.

## Create the project

[Install Codeboard](../start/installation.md). Save the following complete script as `sequence.ts` in an empty working folder and run `codeboard run sequence.ts`. A project-local installation uses `npx codeboard run sequence.ts`.

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { StoryboardProject, pathCommands, renderFramePNG } from 'codeboard-studio';

const project = StoryboardProject.create({
  title: 'Drawing sequence', width: 640, height: 360, frameRate: 24,
});
const shot = project.addScene('Scene').addShot('Movement');
const panel = shot.addPanel({ id: 'panel:movement', durationFrames: 48 });
const track = panel.addGroup('Drawings', { id: 'track:subject' });
const first = panel.addVectorLayer('Triangle', { id: 'drawing:triangle' }, track.id);
first.path(pathCommands('M 0 80 L 40 0 L 80 80 Z'), { fill: '#b77528' });
const second = panel.addVectorLayer('Diamond', { id: 'drawing:diamond' }, track.id);
second.path(pathCommands('M 40 0 L 80 40 L 40 80 L 0 40 Z'), { fill: '#386b72' });

project.production.setDrawingSequence(track.id, [
  { frame: 0, drawingId: first.id },
  { frame: 12, drawingId: second.id },
  { frame: 36, drawingId: first.id },
]);
project.production.addLayerKeyframe(track.id, 0, {
  transform: { x: 80, y: 140 }, easing: 'linear',
});
project.production.addLayerKeyframe(track.id, 47, {
  transform: { x: 460, y: 140 },
});

await mkdir('output', { recursive: true });
await project.save('output/sequence.cboard');
await writeFile('output/frame-12.png', await renderFramePNG(project, 12));
```

Open `output/frame-12.png`. At frame 12 the diamond is selected. The triangle appears at frames 0–11 and 36–47. The track's transform moves whichever drawing is selected; it does not morph one shape into another. All frames here are global board positions because this is the project's first panel.

`setDrawingSequence` takes immediate children of a group. A child can be a drawing layer or a group containing several layers. Reuse its ID for repeated poses; create a separate child when its geometry needs an independent edit. See [drawing holds](../animation/drawing-holds.md) for range operations.

## Reopen and change only the hold

Save this as `revise-sequence.ts`, then run `codeboard run revise-sequence.ts`:

```ts
import { writeFile } from 'node:fs/promises';
import { StoryboardProject, renderFramePNG } from 'codeboard-studio';

const project = await StoryboardProject.open('output/sequence.cboard');
project.production.setDrawingRange('track:subject', 12, 16, 'drawing:triangle');
await project.save('output/sequence-revised.cboard');
await writeFile('output/frame-12-revised.png', await renderFramePNG(project, 12));
```

Compare the PNGs at the same frame. Frames 12–15 now hold the triangle; frame 16 resumes the diamond. The project remains 48 frames long and the track placement keys stay unchanged. Saving to a different path preserves the original file. Do not rerun the creation script over a project you have independently edited.

For your own project, discover the track and drawing IDs with [bounded queries](../reference/object-queries.md); these tutorial IDs are authored values, not built-in names. Use [onion skins](../animation/onion-skins.md) to compare neighboring drawings and [render a movie](../delivery/export.md#movie-with-audio) to inspect pacing.

## Move to independent shot timing

This script uses storyboard layers. To keep a performance on a reusable local timeline, [capture the panel as a shot animation](../animation/shots.md#capture-existing-panel-animation). Edit the captured IDs through shot operations and place its source range in an editorial sequence. Board handles do not address captured shot layers, and moving a clip in an edit does not move the source shot's keys.
