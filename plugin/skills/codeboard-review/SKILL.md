---
name: codeboard-review
description: Use when Codeboard work needs critique, exact-frame inspection, onion skins, validation, storyboard or movie export, or a delivery readiness check.
---

# Match each claim to evidence

Prerequisite: codeboard session context.

Use `verifyReviewExport` to check delivered evidence. Record actual reviewer, criteria and inspected frames with `createReviewDecision`; technical checks alone remain `not-reviewed`. Retain the JSON and exact package, then use `verifyReviewDecision` on handoff. Supply `source: { projectPath }` to reject stale decisions against the saved head; a named revision must be explicit. Read `docs/review.md` for scope and unsigned-record limits.

Read `docs/review.md` and `docs/export.md`; for ghosts read `docs/onion-skin.md`. Resolve render options in `docs/api-render.md`.

Choose the smallest view that answers the review question:

| Question | Evidence |
| --- | --- |
| Composition and continuity | Contact sheet, then relevant full-size panels |
| Line, paint, anatomy | Exact-frame detail crop |
| Different held drawings | Drawing-neighbor intervals and isolated onion samples |
| Camera, transitions, interval boundaries | Exact timeline frames or frame sheet |
| Pace, looping, sound | Actual playback and listening where relevant |

Write returned PNG bytes and open the images. A contact sheet compares panels; it is not a substitute for exact frames. Camera-off onion skins still include layer animation. Recreate a render session after edits because its snapshot stays frozen. Pixel differences locate changes but do not score artistic improvement.

For traceable saved-source evidence, use `exportReview` with an expected version, explicit frames and the board/shot/editorial target. Manifest version 2 identifies each source frame. Follow `docs/review.md`; only a package with its completed manifest is delivered. Inspect its PNGs separately from checking its hashes.

Tie findings to a panel/frame/interval and an observable consequence. Prioritize the request's problem before optional polish. For critique-only work, leave the project unchanged. Route authorized fixes through codeboard-revise and the responsible operation skill, then inspect fresh evidence.

## Deliver the requested format

Validate the saved project. Storyboard export produces panel images and PDF; inspect its captions and pagination. Animatic export produces frames and a manifest. Board MP4 uses FFmpeg and saved assets; shot/editorial MP4 requires explicit mix/omission when audio exists. For either target, confirm the output exists and inspect playback before claiming a film review. Missing FFmpeg is an export limitation, not grounds to label an animatic as MP4.

Keep source, assets, and the `.cboard` with exports. Report separately: commands/validation completed, visuals actually viewed, playback/audio actually checked, and checks unavailable. A render log proves execution; it does not prove the picture or motion is good.
