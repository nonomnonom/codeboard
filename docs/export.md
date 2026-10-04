# Export

Export images for review, paginated storyboard sheets for sharing, or a movie for timing and sound review.

## PNG frames

```js
import { renderPanelPNG, renderFramePNG } from 'codeboard-studio';
import { writeFile } from 'node:fs/promises';

await writeFile('panel.png', await renderPanelPNG(project, 'notice'));
await writeFile('frame-24.png', await renderFramePNG(project, 24));
```

Use a panel render to review a panel and a frame render for a specific timeline moment. [Review tools](review.md) also provide crops, contact sheets, frame sheets, and onion skins.

## Storyboard sheets

```sh
codeboard render film.cboard --output sheets --columns 2 --rows 2
```

The export includes panel images and a paginated PDF. Layout handles the page grid and captions independently of artwork composition. Panel action, dialogue, camera notes, and titles provide caption content.

Through code:

```js
import { exportStoryboard } from 'codeboard-studio';
const result = await exportStoryboard(project, 'sheets', {
  columns: 2, rows: 2, margin: 36, gutter: 18, captionHeight: 96,
});
console.log(result.pdfFile);
```

## Movie with audio

Install FFmpeg, then run:

```sh
codeboard movie film.cboard --output film.mp4
```

To choose an FFmpeg executable explicitly:

```sh
codeboard movie film.cboard --output film.mp4 --ffmpeg /path/to/ffmpeg
```

On Windows use a quoted path to `ffmpeg.exe`. You can also set `FFMPEG_PATH` in your environment. Export evaluates artwork, drawing substitutions, camera, transitions, and audio from the saved project.

```js
import { exportMovie } from 'codeboard-studio';
await exportMovie(project, 'film.mp4', {
  onProgress: (frame, total) => console.log(frame, total),
});
```

Save the project before movie export to include its embedded assets. If exporting an unsaved project with linked assets, provide the correct `assetRoot`.

## Animatic package

```sh
codeboard animatic film.cboard --output animatic
```

This exports frame images and a manifest for an external review or playback workflow. It is separate from the encoded MP4.

## Before delivery

Check the first and last frame of each shot, transitions, the full playback, and audio sync. Keep the `.cboard` file and source scripts with your exports so future feedback can be addressed through code.
