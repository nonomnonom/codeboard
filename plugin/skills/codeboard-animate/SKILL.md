---
name: codeboard-animate
description: Use when Codeboard artwork needs pose changes, drawing holds, transform animation, two-bone joints, stroke reveal, transitions, or retiming.
---

# Separate pose from placement

Prerequisite: codeboard session context.

Read `docs/animation.md`. Read `docs/math.md` for joints and `docs/code-board-demo.md` for a complete authored performance. Resolve mutations through `docs/api-production.md`.

Choose the mechanism that owns the motion:

| Change | Operation family |
| --- | --- |
| Silhouette or pose | Drawing substitutions |
| Position, rotation, scale, opacity | Layer channels |
| Articulated cutout reach | Two-bone rig and authored joint keys |
| Painted line appearing over time | Raster-stroke reveal |
| Shot length and subsequent timing | Panel retime |

Author key poses and contacts before adding intermediate drawings. Reuse a drawing ID for a repeated cel; duplicate it for an independent variation. Substitution selects authored drawings; it does not morph shapes or generate in-betweens. Keep independently timed parts on separate tracks.

## Resolve timing before mutation

Read the owning panel's start, duration, exposures, and relevant keys. Use global integer frames and exclusive range ends. Translate an inclusive user interval once: frames 30 through 35 become [30, 36).

A local hold uses `setDrawingRange` and should resume the existing sequence at its boundary. A longer shot uses panel ripple and changes downstream timing. Check the choice against the requested total duration. For ripple, inspect key collisions and hand internal/crossing sound cues to codeboard-audio. Keep placement keys unchanged for a drawing-only correction.

Key independent channels deliberately. Preserve other channels when deleting or revising a mixed key. For held feet, check whether placement interpolation moves a cel between drawing exposures.

For IK, confirm the documented joint hierarchy, lengths, scales, pivots, and parent-coordinate target. Inspect reachability/error and the resulting pose. Removing a rig definition does not remove authored joint keys.

## Check motion

Use drawing neighbors for adjacent cels rather than blindly sampling frame minus/plus one inside the same hold. Compare soles to a fixed ground line and inspect changed interval boundaries. Use codeboard-review for frame sheets, onion skins, and playback. A still sheet can reveal spacing; it cannot establish pacing or sound synchronization.
