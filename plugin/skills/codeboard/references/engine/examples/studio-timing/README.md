# Studio timing study

A technical 10-second, two-shot fixture at 24 FPS. Colored markers and generated tone cues make timing inspectable; they are not a storytelling or artistic-quality benchmark.

Each shot has 132 local source frames. The initial editorial selects 120 frames from each. Revision moves the second cut first, extends it to 132 frames, then trims the first to 108 frames starting at source frame 12. The movie stays 240 frames; shot artwork and animation keys remain unchanged.

From the repository root:

```sh
npm install
npm run build
npm run studio-timing:author --workspace @codeboard/examples
npm run studio-timing:review --workspace @codeboard/examples
npm run studio-timing:revise --workspace @codeboard/examples
npm run studio-timing:revise --workspace @codeboard/examples
npm run studio-timing:review --workspace @codeboard/examples
npm run studio-timing:export --workspace @codeboard/examples
```

The second revision invocation replays the same persisted plan/request receipt; it does not apply the edit twice. Authoring refuses an existing project. Use a new output directory through the exported author function for a new production. Review/export reopen saved state and never rerun authoring.

Export requires FFmpeg and ffprobe in PATH, or `FFMPEG_PATH` and `FFPROBE_PATH`. It decodes the saved embedded WAV assets and mixes their shot-local timing into H.264/AAC. `delivery.json` identifies the saved project version and movie hash. Review manifests identify source frames and PNG hashes; they are technical evidence, not artistic approval.

Ownership: `src/config.ts` holds fixture settings; `artwork/` owns the two source studies, `audio/` owns cues, `project/` owns authoring and persisted revision, `review/` reads saved state for evidence and delivery, and `cli/` routes commands. Board panels are captured once during authoring; later editorial edits operate on independent studio animation. Capture does not copy board audio, so audio is attached explicitly to each studio animation.

The shared examples workspace uses the local engine through `file:..` and one root lockfile. Rebuild the engine (or run its root watch command) and rerun a command to consume changes; a running process does not hot-reload the engine.
