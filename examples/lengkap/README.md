# LENGKAP

A fictional 15-second satire: six scenes of 60 frames at 24 fps, drawn at 1920 × 1080. The project combines broad ink, pencil contours, charcoal accents, sparse red marks, and original synthesized Foley. It uses no external images or audio.

## Run

[Install Codeboard](../../docs/install.md), then run these commands from the repository root. The source targets release **v0.2.1** and needs no engine build or npm dependencies.

```sh
codeboard run examples/lengkap.ts
codeboard run examples/lengkap/verify.ts
```

For a movie, install FFmpeg on PATH or set `FFMPEG_PATH` to its executable:

```sh
codeboard run examples/lengkap.ts --movie
```

Outputs are in `examples/output/lengkap/`: `lengkap.cboard`, `lengkap-storyboard.png`, `lengkap-hero.png`, original audio, and `lengkap.mp4` when requested. Authoring replaces its generated project; keep independent edits elsewhere.

To render the saved project without rebuilding artwork:

```sh
codeboard run examples/lengkap/render.ts --movie
```

## Edit and verify

`../lengkap.ts` owns composition and timing. `art.ts` provides reusable drawing functions and seven brush presets. `sound.ts` synthesizes the Foley.

Verification checks the 360-frame duration, brush use, stamp contact at frame 134, and the held ending. It shortens one red stroke in scene five, compares every other scene before and after, saves a named alternative, then undoes the edit and reopens the original. Review sheets and evidence are written under `review/`.

[Rendered film](../../docs/media/lengkap.mp4) · [Storyboard](../../docs/media/lengkap-storyboard.png)

Source code is MIT; original artwork and Foley are CC0-1.0. Arial and Segoe Print are host fonts and are not bundled. Font substitution can change text on other operating systems.
