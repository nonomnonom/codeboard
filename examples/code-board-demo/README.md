# Codeboard character walkthrough

The eight-second walk, stop, hop and landing from `code-board-demo`, extracted into a standalone public example. The pose generator and contour drawing functions come from that demo; this package omits its presentation scenes and third-party soundtrack.

Install Node.js 22.22 or later and `npm install -g codeboard-studio@0.2.1`, then run from this folder:

```sh
codeboard run main.mjs
codeboard run revise.mjs
codeboard movie clawd-output/clawd.cboard --output clawd-output/clawd.mp4
```

The first command writes an editable project and three review PNGs into `clawd-output/`. It deliberately replaces its own generated project when rerun. The revision script opens that project and extends the anticipation drawing into frames 126–129; it keeps the 192-frame duration and surrounding exposures. Before/after images both show frame 128.

`main.mjs --movie` also exports an MP4 when FFmpeg is available. Movie export is optional; authoring, saving and PNG review do not require FFmpeg.

Files:

- `poses.mjs`: pose parameters, generated drawing geometry and exposure timing.
- `art.mjs`: vector contours, facial features and pencil accents.
- `main.mjs`: document, drawing track, placement keyframes, save and review.
- `revise.mjs`: a targeted timing revision.

All times are global integer frames at 24 fps. Character contours remain editable vector elements; no character bitmap is used. This is a scripted animation example, not a recording of an autonomous agent session. Clawd is the character depicted in the supplied demo; no endorsement by Anthropic is claimed.

Source code is covered by the repository MIT license. No third-party audio or reference bitmap is included.
