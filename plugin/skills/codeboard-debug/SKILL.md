---
name: codeboard-debug
description: Use when Codeboard commands fail, renders are blank or wrong, edits do not persist, timing is offset, brush imports differ, or export/render memory use blocks the task.
---

# Isolate the failing layer

Prerequisite: codeboard session context.

Read `docs/troubleshooting.md` and the relevant subsystem guide. Record the runtime version, failing command, error, project/frame, and expected result. Reproduce before changing state.

| Symptom | First discriminating check |
| --- | --- |
| Import or TypeScript error | Execute through the CLI runner; check supported syntax and public exports |
| Blank image | Check global frame/exposure, then ancestor visibility, mask alpha, and camera-off isolated render |
| Edit disappears | Check inspection-copy mutation, save target, reopen, and stale-version error |
| One-frame offset | Inspect panel start, exclusive end, and actual keys before interpolation |
| Unexpected rig pose | Compare base keys, controller stack/range and evaluated target pages; inspect skin bind and frame vertices |
| Foreign brush mismatch | Inspect resource/dependency report and a controlled swatch |
| MP4 failure | Separate PNG rendering from FFmpeg, file-lock, and asset-resolution failures |
| Memory pressure | Use bounded queries, partial panel reads, selected layers, and review thumbnails |

Test one causal hypothesis on the smallest relevant object/frame. Preserve the source project. A rendering fix should not remove unseen layers or replace the project to make validation pass. A persistence fix should not bypass conflict detection. An unsupported feature is a capability limit, not necessarily an engine bug.

Verify the original failing operation after the change and inspect the requested result. If a minimal example still fails, retain a sanitized reproduction with version, command, error, and expected/actual frame. Follow contributor instructions before changing engine source within authorized scope. State the verified cause and unresolved evidence without treating guessed explanations as facts.
