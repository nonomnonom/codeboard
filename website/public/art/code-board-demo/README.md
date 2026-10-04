# Codeboard documentation media

`walkthrough.mp4` is the video stream of `code-board-demo/delivery/codeboard-launch-C-funk.mp4`, with all audio removed and MP4 fast-start enabled. It is the 48-second, 1920×1080, 24 fps scripted presentation. `poster.png` is its frame at 1.5 seconds. The original video and its audio remain untouched. No HeyGen audio is included here.

The character performance source was extracted from `code-board-demo/src/poses.ts` and `art.ts` into `examples/code-board-demo/`. The eight-second downloadable example is a separate self-contained teaching project using those original pose and contour functions. It does not reconstruct all presentation scenes.

`node scripts/build-doc-assets.mjs` regenerates `clawd.cboard`, the frame/pose/onion/revision PNGs, three brush swatches, and `source.zip` from that public example through the Codeboard API. The source archive includes the MIT license. Rendering uses fonts installed on the host; no font files or reference bitmap are distributed.

Clawd is the character shown in the user-supplied demo. This material does not assert ownership of third-party character branding or endorsement by Anthropic. The source code is under the repository's MIT license; the previous blanket CC0 statement for other examples does not apply to third-party branding.
