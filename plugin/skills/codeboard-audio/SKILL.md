---
name: codeboard-audio
description: Use when Codeboard sound needs placement, source trimming, splitting, track changes, fades, mix checks, or synchronization after a panel retime.
---

# Keep source time and story time separate

Prerequisite: codeboard session context.

Read `docs/audio.md` and `docs/export.md`; use `docs/api-production.md` for clip mutations.

Find the intended cue, its asset, track, timeline start, source trim, length, and project frame rate. Use paged clip queries for large projects. Changing the event time changes `startFrame`; choosing another source segment changes `sourceInFrame`. Preserve the other fields unless the requested correction includes them.

After a split, inspect both trims and lengths. After moving tracks, check track mute/lock state. Keep actual resource provenance; a synthesized scratch tone tests timing but is not recorded Foley or dialogue.

## Retiming decision

Compare each cue with the panel's old end:

- Cues at or after that boundary ripple with later material.
- Cues starting inside the panel retain placement; retime sync events explicitly.
- Cues starting earlier, such as ambience crossing the shot, retain placement and source duration.

Determine the intended new event frame, then change the responsible clip. A retime does not time-stretch sound. A locked affected track needs its ownership/intention resolved; removing the lock is not a timing fix.

Save with resolved assets before movie export. Check combined levels and fades through playback, including cut-off tails and clipped overlaps. Report structural checks separately from listening: correct clip metadata does not prove audible synchronization or mix quality. Use codeboard-review for final movie delivery or codeboard-debug for encoding failures.
