# Sequences, shots, and panels

A sequence contains scenes; a scene contains shots; a shot contains ordered panels. A panel is an artwork composition with a duration and production captions. A storyboard sheet is a separate page layout built from those panels.

## Build a shot from several beats

```js
import { StoryboardProject } from 'codeboard-studio';
const project = StoryboardProject.create({
  title: 'One considered hop', width: 1920, height: 1080, frameRate: 24,
});
const sequence = project.addSequence('The obstacle', 'obstacle');
const scene = sequence.addScene('Street', 'street');
const shot = scene.addShot('Notice and decide', 'notice-shot');
const notice = shot.addPanel({
  id: 'notice', number: '01A', title: 'Notice', durationFrames: 48,
  action: 'Clawd stops at the line.', dialogue: '',
  camera: 'Locked medium wide.', notes: 'Let the gaze lead the body.',
});
const prepare = shot.addPanel({
  id: 'prepare', number: '01B', title: 'Prepare', durationFrames: 24,
  action: 'Weight lowers before the push.',
});
```

Panel captions describe the action; they do not generate artwork. Draw each panel through its layers, or use a drawing sequence within a panel for changing poses. Choose the number of panels according to the action you need to explain.

## Notes and movement arrows

```js
notice.revise({ notes: 'Keep all four feet readable.' });
notice.addMotion('Look toward the line',
  { x: 1000, y: 500 }, { x: 1250, y: 500 }, '#f48136');
```

Movement annotations describe intent; they are not motion keyframes. Render panels with annotations for review, or set `annotations: false` for clean artwork. Titles, action, dialogue, camera notes, and general notes supply the storyboard sheet captions.

## Order, duplicate, and remove panels

```js
const alternative = project.production.duplicatePanel(prepare.id);
project.production.movePanel(alternative, prepare.id);
project.production.setPanelNumber(alternative, '01B-alt');
project.production.deletePanel(alternative);
```

`movePanel` reorders within the panel's existing shot; omitting the destination moves it to the end of that shot. It does not move a panel between shots. Duplication creates new object IDs and remaps contained relationships. Deletion removes that panel's artwork. Timeline structural edits reflow following material; inspect timing and audio afterward.

Panel numbers are display labels. Use IDs to address a panel across numbering changes. `setPanelStatus(id, 'working' | 'review' | 'approved')` records production status; approval status is not a substitute for review or an edit lock.

## Layout the sheets

```js
import { exportStoryboard } from 'codeboard-studio';
await exportStoryboard(project, 'sheets', {
  columns: 2, rows: 2, pageWidth: 1191, pageHeight: 842,
  margin: 36, gutter: 18, captionHeight: 110,
});
```

Page sizes and spacing are layout units. The exporter lays out headers, captions, numbers and pagination independently of the 1920 × 1080 artwork. It samples each panel at 60% of its duration for the sheet image. Use explicit frame renders when another moment is needed for timing review.

See [animation](animation.md) for retiming and transitions, [review](review.md) for contact sheets, and [export](export.md) for delivery formats.
