# Evaluation results — 5 October 2026

## Conditions and evidence

Engine: Codeboard 0.2.1, Node 22.22.0, Windows x64. Trials used fresh collaboration agents inheriting the parent's model/settings with no conversation fork. The exact runtime model identifier was not exposed. Baseline agents had engine docs/public source and were told not to load skills. Candidate agents received the same tasks and were explicitly told to discover and use the plugin. This tests use after invocation, not automatic host activation.

Each operation had one baseline and one candidate sample. Brush and hold corrections each had an additional fresh candidate; the installed-package check below adds two fresh trials. These are smoke evaluations, not repeated wording experiments or a statistical comparison. Agents wrote action logs; complete machine-exported conversation transcripts were not available. Independent grading opens actual saved artifacts. Repository-backed evidence remains in the repository's ignored `.preview/codeboard-evals/` directory.

## Artifact outcomes

| Task | Docs-only baseline | Candidate | Evidence checked independently |
| --- | --- | --- | --- |
| Local drawing hold | Pass | Pass | Exclusive end, resumed exposure, unchanged artwork/timing/camera/audio, exact before/after PNGs |
| Panel retime with camera/audio | Pass | Pass | Panel duration, following start, interior cue, crossing ambience, retained trim/volume, mixed camera channels, saved images |
| KPP import and missing dependency | Pass after recovery | Pass after recovery | Real reports, missing tip remains absent, saved 3×2 alpha tip, editable stroke and PNG |
| Brush after documentation correction | Not rerun | Pass without operation errors | Same independent brush checks against a fresh task directory |
| Hold after return-shape guidance | Not rerun | Pass after verification recovery | Same hold checks; initial preservation assertion did not allow routine engine metadata |

Baseline run: `run-NjnBPw`. Candidate run: `run-A5QJ8J`. Corrections: `run-RydsDm/brush` and `run-RydsDm/hold`. Grader outputs are `grade.json` or `grade-<case>.json`; per-task folders retain `actions.md`, `result.md`, scripts, and artwork. Environment files retain documentation/source hashes; pre-revision and candidate skill snapshots are retained with the first two runs.

All three baseline artifacts already passed. No artifact success-rate improvement is claimed. The baseline retime trial recovered from an absolute Windows ESM import error. The baseline brush trial guessed two nonexistent source paths and constructed incomplete brush dynamics before recovering. The candidate hold trial queried an absent overview field during inspection; no edit depended on that value. Those observations remain in action logs rather than being erased from the result.

## Defect found through execution

The first candidate brush trial followed `docs/brushes.md` and called `brushParameterSchema.parse()`. Runtime inspection showed the export is JSON Schema data, not a parser. The agent recovered, but this was a real documentation-induced failure.

The brush guide, generated drawing-reference introduction, and its generator now describe the actual export and project-level validation through `production.createBrush`. The brush skill uses that public operation. Direct runtime checks confirmed schema shape, rejection of incomplete dynamics, and successful validation after `customizeBrush`. A fresh brush trial then completed without the failed parse call. This is a docs-plus-skill correction, not isolated evidence of better prompt wording.

## Grader checks

Untouched task fixtures failed all three artifact criteria. After a real passing run, `test-grader.mjs` copied its outputs and introduced three plausible errors: holding one extra frame, leaving the interior cue at its old start, and fabricating a fallback tip in the unresolved import report. All three were rejected. Evidence: `grader-negative-mnqUfI`.

## Read-only capability and discovery probes

All 12 baseline and all 12 candidate answers satisfied the documented rubric on manual review. Both rejected the invented in-between API, native Harmony import, KPP preview fallback, silent stale overwrite, and claims of unseen/unheard verification. The candidate selected the relevant named skills and excluded Codeboard for React Storybook. Raw answers, source citations, action logs, and item-level manual grades are in `probes-baseline/` and `probes-candidate/` beneath the evidence root.

These are two fresh-agent batches, each containing twelve questions. They are not twelve independent sessions or repeated trials. The candidate explicitly received the skill catalog; this does not prove host auto-triggering. Baseline had no skill catalog, so its operation choices were reviewed rather than comparing nonexistent skill names. Probe answers were not executed.

## Installed-package portability

The earlier repository-backed evaluations missed a packaging defect: they provided source documentation that would not accompany an installed plugin. Those passes did not prove portability. The plugin now ships a generated reference bundle with all 29 root guides, navigation metadata, media notes, quickstart, standalone character-demo source, LICENSE and NOTICE (39 source files).

`prepare-installed.mjs` staged a standalone plugin and a built engine layout outside the engine checkout, then installed the plugin through Codex into a fresh host home. All ten installed skill files matched source bytes; all 39 installed reference hashes matched the manifest. The runtime directory contained compiled public code/declarations and existing dependencies, but no root docs or source checkout. This was a staged package-layout test, not a freshly downloaded engine installer.

Two fresh agents received only installed plugin/runtime paths and separate task folders, with repository access and network forbidden. Both independently graded artifacts passed: hold and brush. Action logs cite the installed bundled docs and record actual image inspection. Brush completed without failures. Hold recovered from a preservation assertion that initially treated routine metadata changes as unintended edits; it corrected the assertion before saving and passed the independent semantic checks. No missing reference was reported. This was instruction-scoped isolation, not an OS-enforced sandbox or a network packet audit.

Evidence is in the workspace's ignored `.preview/codeboard-portable-eval/installed-oQuf7w/`: `install.log`, `environment.json`, the frozen installed plugin, and `tasks/run-6ipnRS/{hold,brush}` with separate `grade-hold.json` and `grade-brush.json`. The retime fixture in that run was not executed. A separate automated sync regression passes for canonical source changes, manual bundle tampering, renamed documents, internal/media link conversion, and containment of obsolete-file deletion.

## Limits

Image inspections are recorded in agent logs; PNG equality proves rendered evidence matches saved state, not artistic quality. No sound was heard and no MP4 export was exercised. The trials do not exercise every pixel, IK, storage recovery, or component workflow. Claude host loading, automatic skill discovery in a clean host session, and cross-model reliability remain unverified.
