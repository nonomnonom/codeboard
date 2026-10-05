---
name: codeboard-storyboard
description: Use when a Codeboard brief needs scenes, shots, panels, production captions, or changes to storyboard order and duration.
---

# Make each beat readable

Prerequisite: codeboard session context.

Read `docs/animation/storyboards.md`; use `docs/reference/api/project.md` for construction and `docs/reference/api/production.md` for structural edits.

Separate three decisions: what changes in the story, where the viewer sees it, and how long it reads. Choose panels for meaningful beats and shots for framing intent. A performance inside one shot may belong in a drawing track instead of many nearly identical panels.

Establish canvas, frame rate, and duration from the brief. Block the compositions before detailed drawing. Preserve supplied dialogue and use captions to describe real action; captions and motion arrows do not generate or animate artwork. Use codeboard-draw for the images.

Assign stable panel IDs and separate display numbers. Check staging, gaze, screen direction, and continuity in a contact sheet. Do not impose a fixed panel count or scene template on unrelated briefs.

For Final Draft input, use `inspectScriptFDX` before `importScriptFDX`. Review the loss report and bind every inspected paragraph to an explicit script entry ID and panel links using the inspected source hash. Reinspect and reconcile bindings when the source changes; paragraph positions are not persistent identities. Import defaults to rejecting losses. Only select `lossPolicy: 'report'` when the requested conversion permits the listed omissions. Apply the detached script through revision-checked replacement or a durable plan; retain the source FDX and mapping for future revisions.

For existing boards, use codeboard-revise before structural mutation. Inspect the affected shot and following timing. `movePanel` reorders within its shot; it does not transfer a panel between shots. Duplication remaps IDs. Deletion and duration changes can shift later material. Use codeboard-animate and codeboard-audio for those timing consequences.

To capture a whole board as studio shots/editorial, page `boardPanels` or CLI `board-data`, supply explicit new IDs to `planBoardCapture`, and choose audio conversion or reported omission. CLI `editorial-data` pages resulting clips; pin subsequent pages with `--expected-version`. Read `docs/animation/shots.md` for held transitions, source sample rates and limits. Save the returned plan before committing; retain the original board.

Check the actual exported sheet for captions, ordering, and pagination. Its image is sampled within each panel; when the intended beat lies elsewhere, inspect an explicit timeline frame instead. Production status records a decision, not an edit lock or proof of human approval. Use codeboard-review for delivery.
