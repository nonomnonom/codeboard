---
name: codeboard-review
description: Use when Codeboard work needs critique, exact-frame inspection, onion skins, validation, storyboard or movie export, or a delivery readiness check.
---

# Match each claim to evidence

Prerequisite: codeboard session context.

Read `docs/workflow/review.md` for inspection and `docs/delivery/export.md` when exporting. For board ghosts use `docs/animation/onion-skins.md`; independent shots use local-frame shot renders. Load `docs/delivery/frame-jobs.md` only for stored/resumable frames. Resolve render options in `docs/reference/api/render.md`.

Choose the smallest view that answers the review question:

| Question | Evidence |
| --- | --- |
| Composition and continuity | Contact sheet, then relevant full-size panels |
| Line, paint, anatomy | Exact-frame detail crop |
| Different held drawings | Drawing-neighbor intervals and isolated onion samples |
| Camera, transitions, interval boundaries | Exact timeline frames or frame sheet |
| Pace, looping, sound | Actual playback and listening where relevant |

Write returned PNG bytes and open the images. A contact sheet compares panels; it is not a substitute for exact frames. Camera-off onion skins still include layer animation. Recreate a render session after edits because its snapshot stays frozen. Pixel differences locate changes but do not score artistic improvement.

When a traceable review package is needed, read `docs/workflow/review-packages.md` and use `exportReview` with an expected version, explicit frames and a board/shot/editorial target. Require its completed manifest and verify it with `verifyReviewExport`; inspect PNGs separately from checking hashes. For a recorded approval or rejection, read `docs/workflow/review-decisions.md`, use `createReviewDecision` and verify it against the intended saved source. Technical checks alone remain `not-reviewed`. Ordinary image critique does not require a decision package.

Tie findings to a panel/frame/interval and an observable consequence. Prioritize the request's problem before optional polish. For critique-only work, leave the project unchanged. Route authorized fixes through codeboard-revise and the responsible operation skill, then inspect fresh evidence.

## Deliver the requested format

Validate the saved project. Storyboard export produces panel images and PDF; inspect its captions and pagination. Animatic export produces frames and a manifest. Board MP4 uses FFmpeg and saved assets; shot/editorial MP4 requires explicit mix/omission when audio exists. For either target, confirm the output exists and inspect playback before claiming a film review. Missing FFmpeg is an export limitation, not grounds to label an animatic as MP4.

Keep source, assets, and the `.cboard` with exports. Report separately: commands/validation completed, visuals actually viewed, playback/audio actually checked, and checks unavailable. A render log proves execution; it does not prove the picture or motion is good.
