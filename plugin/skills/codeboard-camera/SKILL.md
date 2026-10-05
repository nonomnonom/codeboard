---
name: codeboard-camera
description: Use when a Codeboard shot needs reframing, pan or zoom keys, a camera-only correction, or multiplane parallax.
---

# Change framing without redrawing

Prerequisite: codeboard session context.

Read `docs/animation/camera.md`. Use `docs/drawing/geometry.md` for coordinate mapping and `docs/reference/api/production.md` for channel operations.

Identify the timeline first: board camera keys use global frames; independent shot-animation camera keys use signed local frames. For the latter, read `docs/animation/shot-layers.md`: `camera.key.put` replaces the complete key by ID, whereas board key updates merge supplied channels. Inspect existing keys before editing. Compare the artwork with camera on and off to distinguish framing from geometry.

Compose the endpoints around what the viewer must see. Key only the required channels. Camera pan is a viewing offset, not the subject's position; confirm direction in a rendered frame. When adjusting a mixed key, retain its identity and unrelated channels. When evaluating manually, include bracketing keys, not merely the first query page.

For parallax, put foreground, subject, and background on appropriate root planes. Children inherit that root plane. Positive depth controls projection response; sibling order still controls overlap. Check off-frame coverage rather than assuming depth creates missing geometry.

After retiming, re-query key frames by identity before applying a midpoint correction. Do not apply the correction at an obsolete frame or reset the pan to obtain the requested zoom.

Inspect the start, midpoint, end, and any tight overlap. Check crop safety, revealed edges, motion direction, and boundary discontinuity. Guides are review overlays, not delivered geometry. A camera-only change should preserve source artwork; use codeboard-revise for saved-work persistence and codeboard-review for temporal evidence.
