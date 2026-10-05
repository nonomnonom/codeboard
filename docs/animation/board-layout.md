# Annotate and arrange a storyboard

Add movement notes, reorder beats and lay out presentation sheets. An arrow describes movement; keyframes create it.

<!-- study:hierarchy:start -->
**Where does a drawing live?.** How do scenes, shots, panels and layers fit together?

[![Read from the whole project toward individual artwork. Each level gives you a smaller part to organize or edit.](../../website/public/art/guides/hierarchy.png)](../../website/public/art/guides/hierarchy.png)

Read from the whole project toward individual artwork. Each level gives you a smaller part to organize or edit. Story structure and drawing layers solve different problems. This is an explanatory diagram, not a rendered film.

<!-- study:hierarchy:end -->

## Notes and movement arrows

```ts
notice.revise({ notes: 'Keep all four feet readable.' });
notice.addMotion('Look toward the line',
  { x: 1000, y: 500 }, { x: 1250, y: 500 }, '#f48136');
```

Movement annotations describe intent; they are not motion keyframes. Render panels with annotations for review, or set `annotations: false` for clean artwork. Titles, action, dialogue, camera notes, and general notes supply the storyboard sheet captions.

## Order, duplicate, and remove panels

```ts
const alternative = project.production.duplicatePanel(prepare.id);
project.production.movePanel(alternative, prepare.id);
project.production.setPanelNumber(alternative, '01B-alt');
project.production.deletePanel(alternative);
```

`movePanel` reorders within the panel's existing shot; omitting the destination moves it to the end of that shot. It does not move a panel between shots. Duplication creates new object IDs and remaps contained relationships. Deletion removes that panel's artwork. Timeline structural edits reflow following material; inspect timing and audio afterward.

Panel numbers are display labels. Use IDs to address a panel across numbering changes. `setPanelStatus(id, 'working' | 'review' | 'approved')` records production status; approval status is not a substitute for review or an edit lock.

## Layout the sheets

```ts
import { exportStoryboard } from 'codeboard-studio';
await exportStoryboard(project, 'sheets', {
  columns: 2, rows: 2, pageWidth: 1191, pageHeight: 842,
  margin: 36, gutter: 18, captionHeight: 110,
});
```

Page sizes and spacing are layout units. The exporter lays out headers, captions, numbers and pagination independently of the 1920 × 1080 artwork. It samples each panel at 60% of its duration for the sheet image. Use explicit frame renders when another moment is needed for timing review.

See [animation](timing.md) for retiming and transitions, [review](../workflow/review.md) for contact sheets, and [export](../delivery/export.md) for delivery formats.
