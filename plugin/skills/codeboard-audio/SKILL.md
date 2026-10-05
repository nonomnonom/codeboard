---
name: codeboard-audio
description: Use when Codeboard sound needs placement, source trimming, splitting, track changes, fades, mix checks, or synchronization after a panel retime.
---

# Keep source time and story time separate

Prerequisite: codeboard session context.

Read `docs/audio/board-audio.md` for boards; for independent shots use `docs/audio/shot-audio.md`, `docs/audio/editing.md` and `docs/audio/mixing.md`. For delivery read `docs/audio/stems.md` and `docs/delivery/movies.md`; use `docs/reference/api/production.md` for clip mutations.

Identify the cue's board, shot-animation or editorial owner, asset, track, placement and source trim. Use paged queries for large projects. Board clips use `startFrame` and `sourceInFrame` in the project rate. Studio clips use rational `start` and source sample fields; changing nested `start` or `source` requires its complete value. Preserve unrelated fields.

After a split, inspect both trims and lengths. After moving tracks, check track mute/lock state. Keep actual resource provenance; a synthesized scratch tone tests timing but is not recorded Foley or dialogue.

## Board panel retiming

Compare each cue with the panel's old end:

- Cues at or after that boundary ripple with later material.
- Cues starting inside the panel retain placement; retime sync events explicitly.
- Cues starting earlier, such as ambience crossing the shot, retain placement and source duration.

Determine the intended new event frame, then change the responsible clip. A retime does not time-stretch sound. A locked affected track needs its ownership/intention resolved; removing the lock is not a timing fix.

These rules describe board audio. Studio clips use sample trims and rational placement; read `docs/animation/retiming.md` before changing an independent shot's duration, and `docs/audio/editing.md` for sample-based splits. Do not pass board frame offsets to studio sample fields.

Save with resolved assets before movie export. Check combined levels and fades through playback, including cut-off tails and clipped overlaps. Report structural checks separately from listening: correct clip metadata does not prove audible synchronization or mix quality. Use codeboard-review for final movie delivery or codeboard-debug for encoding failures.
