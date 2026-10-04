---
name: codeboard-camera
description: Use when a Codeboard shot needs reframing, pan or zoom keys, a camera-only correction, or multiplane parallax.
---

# Change framing without redrawing

Prerequisite: codeboard session context.

Read `docs/camera.md`. Use `docs/math.md` for coordinate mapping and `docs/api-production.md` for channel operations.

Inspect the shot's existing keys and the intended global frame. Compare the same artwork with camera on and off before deciding whether a placement problem belongs to camera or drawing geometry.

Compose the endpoints around what the viewer must see. Key only the required channels. Camera pan is a viewing offset, not the subject's position; confirm direction in a rendered frame. When adjusting a mixed key, retain its identity and unrelated channels. When evaluating manually, include bracketing keys, not merely the first query page.

For parallax, put foreground, subject, and background on appropriate root planes. Children inherit that root plane. Positive depth controls projection response; sibling order still controls overlap. Check off-frame coverage rather than assuming depth creates missing geometry.

After retiming, re-query key frames by identity before applying a midpoint correction. Do not apply the correction at an obsolete frame or reset the pan to obtain the requested zoom.

Inspect the start, midpoint, end, and any tight overlap. Check crop safety, revealed edges, motion direction, and boundary discontinuity. Guides are review overlays, not delivered geometry. A camera-only change should preserve source artwork; use codeboard-revise for saved-work persistence and codeboard-review for temporal evidence.
