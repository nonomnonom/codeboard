# Codeboard launch demo

A 48-second, 1920 × 1080 film at 24 fps, authored through the public Codeboard API. It includes a 32-drawing turnaround, procedural pose controls, storyboard, revision, timing studies, and an eight-second walk, pause, hop, and landing.

The terminal scenes are a scripted presentation of an agent workflow. They are not a recording of an agent session. Displayed pose source and verification counts come from the actual authoring files and saved projects.

## Run with the released CLI

Install [Codeboard](https://codeboard.nonom.xyz/docs/install/) and open a new terminal. This source targets **v0.2.1**. No npm install, TypeScript compiler, engine checkout, or separate Node installation is needed. The `codeboard` command must be on PATH because the pipeline invokes it for each stage.

From this directory:

```sh
codeboard --version
codeboard run src/run.ts author
```

To render the film, install FFmpeg and make `ffmpeg` available on PATH, then run:

```sh
codeboard run src/run.ts render
```

Alternatively set `FFMPEG_PATH` to the executable's full path. In PowerShell:

```powershell
$env:FFMPEG_PATH = 'C:/tools/ffmpeg/bin/ffmpeg.exe'
codeboard run src/run.ts render
```

The pipeline stops on an error. Authoring, verification, and movie rendering run in separate CLI processes so document and renderer memory is released between stages.

## Outputs and review

The default output directory is `codeboard-demo-output/` in the terminal's working directory. Set `CODEBOARD_DEMO_OUTPUT` to choose another directory. Source files are found relative to their module, so invoking the entry point from elsewhere also works.

| Output | Contents |
| --- | --- |
| `performance/clawd-final.cboard` | Editable eight-second performance with synthesized Foley |
| `performance/codeboard-showreel.cboard` | Twenty-four-second breakdown |
| `performance/contact-sheet.png` | Actual key drawings and in-betweens |
| `performance/review/` | Exposure sheets and full-resolution pose crops |
| `launch/codeboard-launch.cboard` | Editable 48-second presentation |
| `launch/codeboard-launch.mp4` | Film with original synthesized Foley (`render` command) |
| `launch/launch-overview.png` | Timeline samples from every scene |
| `launch/turnaround-sheet.png` | Turnaround samples; individual crops are in `launch/review/` |
| `launch/verification.json` | Frame equality, timing, turnaround and curve checks |

```sh
codeboard run src/run.ts verify
codeboard preview codeboard-demo-output/launch/codeboard-launch.cboard
codeboard movie codeboard-demo-output/performance/clawd-final.cboard --output clawd.mp4
```

Running `author` or `render` regenerates its own outputs. Copy an independently edited project elsewhere before regenerating. To export an edited project, use `codeboard movie` directly instead.

## Source

- `poses.ts` and `art.ts`: editable character geometry, exposures, placement and drawing functions.
- `author.ts`: performance, breakdown, original synthesized audio and contact sheet.
- `studio-scenes.ts`, `studio-props.ts`, `claude-terminal.ts`, `final-stage.ts`: authored presentation artwork.
- `launch.ts`: sequence timing, displayed source, movie export and editable project.
- `verify.ts`, `verify-launch.ts`, `turn-review.ts`: saved-project comparisons and review images.
- `review/playback.ts`: optional browser playback inspection script; prepare it with `codeboard run src/run.ts review-script`.

Verification compares all 192 performance frames across the standalone clip and presentation. It also checks planted-foot drift, distinct drawing images, exposure counts, four leg contours per turnaround drawing, and the authored Bézier flight curve.

Fonts come from the host system (Arial, Consolas and Segoe Print); they are not bundled. Exact text appearance can vary between operating systems. Code is MIT; the synthesized Foley is CC0-1.0. No external images or audio are required. Clawd and Claude branding belong to their respective owners; this example implies no affiliation or endorsement.
