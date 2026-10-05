---
name: codeboard-revise
description: Use when modifying an existing Codeboard .cboard, applying review feedback, preserving a checkpoint, or resolving a stale save or actor-owned lock.
---

# Preserve the current saved state

Prerequisite: codeboard session context.

Read `docs/projects.md` and `docs/review.md`. Use `docs/api-storage.md` for checkpoints/partial reads and the operation's production reference for mutations.

Open the latest project. Find the target with a bounded query and inspect its kind, ID, owner, and current values. State the intended delta and what must remain unchanged. Capture the relevant before frame or crop.

Use `production.summary()`/`production.query()` for open sessions, or `ProjectStore.query()` for saved metadata without decoding artwork when `indexed` is true. Restart cursor pagination after an edit or reopening. For `CodeboardError` with code `REVISION_CONFLICT`, inspect `details.expected` and `details.actual`, reopen and re-evaluate the intended delta. Do not reuse stale cursors or hide conflicts with overwrite. Other legacy failures may still be ordinary errors.

Apply the operation through a handle or production method; inspection values are copies. Group synchronous related edits in one transaction. Run asynchronous reads, renders, and saves outside it. Render the changed area and its relevant neighbors, reject an unsuccessful experiment with undo, then save normally. Reopen to verify persisted state when making a consequential change.

For retryable edits supported by the command list, read `docs/agent-workflow.md` and use `plan()`/`commit()`. Persist the exact plan and request ID first. Retry an uncertain commit with both unchanged; `replayed` returns the original receipt without modifying current artwork. `REQUEST_ID_REUSED` means a different plan already used that ID. A fresh `REVISION_CONFLICT` requires reopening and replanning. For shot-local content, use studio commands, `planShotAnimation` and `planShotElement` as documented there; existing board handles do not address studio layers. Other SDK operations are not yet plan commands.

## Handle replacement and conflict

| Situation | Action |
| --- | --- |
| Another writer changed the file | Reopen, re-query, reapply the intended delta; resolve conflicting intent before replacement |
| Checkpoint needed across sessions | Save a uniquely named revision with the observed version |
| Restore an older revision | Preserve newer work first, restore deliberately, then reopen |
| Component instance refresh | Preserve local artwork and comment anchors before replacement |
| Tracked board/shot component upgrade | Read `docs/components.md`; inspect origin and preview, resolve conflicts explicitly, then apply the hash-guarded upgrade plan. A resolved merge still requires project validation and visual review |
| Another actor owns a lock | Identify the owner and report the blocked target; do not impersonate the owner |
| Invalid project | Preserve the original for recovery |

Do not conceal a stale-write error with `overwrite: true`. Do not rerun an old generator over independently edited work. A partial store update is for an artwork-only change; topology and timeline edits belong to the full authoring session. Close storage handles in `finally`. Compaction is maintenance, not a save step.

Return the current project, operation script, changed IDs/frames, and evidence of the requested delta. Use codeboard-review to assess quality. A critique-only request does not authorize artwork edits or production-status changes.
