---
name: codeboard-animate
description: Use when Codeboard artwork needs drawing holds, poses, skin or curve deformation, named rig controllers, reusable controller performance, transform animation, joints, or retiming.
---

# Separate pose from placement

Prerequisite: codeboard session context.

Read `docs/animation/timing.md` for board timing, `docs/animation/shot-layers.md` for local keys, `docs/drawing/geometry.md` for joints and `docs/reference/api/production.md` for mutations. For skin/controller authoring or performance handoff, follow `docs/animation/rigging.md` and consult the installed public declarations before using recent APIs.

| Change | Mechanism |
| --- | --- |
| Authored silhouette | Drawing substitutions |
| Position, rotation, scale, opacity | Layer channels |
| One baked numeric correction | Shot `layer.pose` |
| Articulated cutout reach | Two-bone rig and joint keys |
| Geometric deformation | Shot mesh, curve, envelope or skin binding |
| Live multi-layer pose blend | Named shot controller |
| Reuse numeric controller motion | Controller performance package and explicit mappings |
| Reuse a complete same-project rig | `animation.duplicate`; read `docs/animation/rigging.md` for copied ownership and shared dependencies |
| Isolate a shot for handoff | `exportShotProject`; inspect dependencies and external fonts before destination review |
| Painted line appearing over time | Raster-stroke reveal |
| Board panel length and subsequent timing | Panel retime |
| Independent shot length and its local curves | Shot retime with explicit audio policy |

Author contacts and key poses before intermediate drawings. Reuse a drawing ID for a repeated cel; duplicate it for an independent variation. Substitution selects drawings, not shape morphs. Keep independently timed parts on separate tracks.

## Resolve timing and ownership

Read duration and relevant keys. Page exposures with `drawingExposures` and choices with `drawingAlternatives`. Board frames are global nonnegative integers; shot frames are signed local integers. Ends are exclusive: frames 30 through 35 become [30,36).

Use `production.setDrawingRange` for board holds or shot `layer.drawing.range`; both preserve surrounding exposures. Panel ripple moves downstream timing: inspect collisions and hand crossing sound cues to codeboard-audio. Preserve placement keys for drawing-only revisions.

For whole-shot timing, preview `retimeShotAnimation`, then plan `timing.retime`. Choose audio policy explicitly; check editorial source ranges before shortening. Read `docs/animation/retiming.md` for rounding and duration semantics.

For IK, inspect hierarchy, lengths, scales, pivots and parent-space target. Removing a rig does not remove keys. `layer.rig.rest.capture/apply` restores cutout joints; skin bind capture instead changes deformation interpretation. Do not interchange them.

## Choose baked or live correction

`layer.pose` samples the current draft and writes ordinary keys. Retain an existing frame's key ID or supply a globally unique one. Choose replacement/additive math deliberately; additive retries must reuse the exact saved plan/request pair.

Controllers preserve base keys and blend in saved stack order. Inspect `shotControllerData` before changing weight, keys, range or order. Captured controllers start inactive. Static weight has no effect while a weight track exists. Additive activation can double an already applied pose.

For deformation, inspect `shotMeshData`; use frame vertex pages and `shotPointCoordinates` for non-affine geometry. Preserve all inverse candidates. Use explicit joint weights and references; do not invent automatic binding or crossing-mask support.

## Review the result

Use drawing neighbors rather than adjacent frames inside one hold. Review changed interval boundaries, controller range boundaries, contacts and representative intermediate poses through codeboard-review. A still sheet cannot establish pacing or sound synchronization. Distinguish static validation, rendered evidence and unqualified production behavior in the handoff.
