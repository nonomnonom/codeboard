# Curated showcase assets

`lengkap-storyboard.png` and `lengkap.mp4` are rendered from [the LENGKAP authoring source](../../examples/lengkap/src/cli/run.ts). Original artwork and Foley are CC0-1.0; the film contains no generated images or third-party audio.

To update them, render and visually inspect `npm run lengkap:author --workspace @codeboard/examples` followed by `npm run lengkap:render --workspace @codeboard/examples -- --movie`, then explicitly copy the approved `lengkap-storyboard.png` and `lengkap.mp4` from `examples/lengkap/output/` here. Check the movie remains 1920 × 1080, 24 fps, 360 frames and exactly 15 seconds. Fonts are not bundled.
