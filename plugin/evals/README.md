# Evaluating the Codeboard skills

These evals separate package validity, agent behavior, and engine correctness. A valid SKILL.md or an engine unit-test pass is not evidence that an agent used the skill well.

## Artifact tasks

From the Codeboard repository root, with its engine built:

```sh
node plugin/evals/run.mjs prepare .preview/codeboard-evals
```

This creates a unique run directory with three isolated tasks and real input files. The requests are in `cases.json`. The evaluator's `truth.json` stays outside the task folders and is not agent input.

For each task, start a fresh agent with access to the engine docs and its task directory. Give it `task.md` and these conditions:

- Baseline: do not load plugin skills.
- Candidate: read the plugin's skill descriptions, load `codeboard`, and select relevant operation skills by name.
- Keep the same model, reasoning setting, tools, and task inputs across conditions. Do not carry baseline conversation into the candidate.
- Write only inside the assigned task directory. Do not inspect the evaluator, truth data, other task directories, or prior runs. Do not modify skills while a candidate run is active.
- Retain generated scripts, `actions.md`, `result.md`, render evidence, and the actual project. If the host exports a complete transcript, retain it too. Agent-authored actions logs are not equivalent to a full transcript.

Then run:

```sh
node plugin/evals/run.mjs grade <run-directory>
```

The grader independently opens saved projects and checks hold boundaries, unchanged content, timing, camera channels, audio offsets, actual brush import reports, and persisted bitmap tips. It checks evidence files but cannot prove they were viewed. Review the agent's actions and claims separately. Before first use, run the grader on untouched fixtures: it must fail all three tasks.

After obtaining a passing run, test the grader itself:

```sh
node plugin/evals/test-grader.mjs <passing-run-directory>
```

This copies the run into a new temporary folder, introduces an off-by-one hold, an unsynchronized interior cue, and a fabricated fallback tip, then requires all three to fail. The supplied run remains unchanged except its regenerated grade file. To grade a single task rerun, append its ID: `node plugin/evals/run.mjs grade <run-directory> brush`.

## Installed-package portability

Repository-backed trials cannot prove that references ship with an installed plugin. Stage a separate runtime, standalone distribution, fresh Codex home, and fresh fixtures:

```sh
node plugin/evals/prepare-installed.mjs <temporary-parent> <path-to-codex/bin/codex.js>
```

Use a temporary parent outside the engine checkout. The script copies the built engine's package layout and existing dependencies (without repository source/docs), installs the standalone plugin through Codex, and checks all ten skill files and every bundled reference hash in the host cache. It changes no user host configuration and performs no dependency installation. This requires an already installed Codex CLI, a built engine, and existing engine dependencies.

Start fresh candidate agents with only their task directory, staged runtime, and installed plugin paths from the output. Require bundled references; forbid original repository/source access, network, other tasks, and evaluator truth. This is a scope restriction, not an OS sandbox. Retain the installed copy as the exact input snapshot and grade the outputs with `run.mjs grade <run-directory> <case-id>`. Check action logs for source use; do not count installation success as successful agent behavior.

## Read-only probes

Give a fresh agent `probes.json`, skill descriptions (candidate only), and engine docs. Request one answer per ID with `skills`, `answer`, and `sources`. Do not provide this rubric while it answers.

Review against these criteria:

- `storybook`: no Codeboard skill for React Storybook.
- `drawing`: draw operation, editable representation, local relevant docs.
- `brush`: unresolved tip is reported; no preview-as-tip fallback.
- `hold`: drawing range with an exclusive end at 36, no panel ripple.
- `retime`: explicit interior cue handling; crossing audio is not time-stretched.
- `camera`: preserve unrelated channels on the existing key.
- `review`: do not claim unseen/unheard evidence; no project mutation.
- `debug`: frame/exposure, visibility/ancestors, masks, camera; no speculative deletion.
- `inbetweens`: no invented generateInbetweens; author drawings/use substitutions.
- `toonboom`: no native Harmony import or automatic rig conversion.
- `oldpaint`: library revision affects future strokes; old strokes need explicit edits.
- `conflict`: reopen/reapply, no silent destructive overwrite.

Record exact failures and sources rather than counting matching words. A quoted unsupported API name is not a hallucination if the agent rejects it. Likewise, naming a skill does not prove it was read.

## Reporting

Record environment, engine version, source hashes, condition, agent identity, prompts, output paths, independent grade, and manual findings. Keep raw generated evidence in `.preview/`, not maintained docs. A short results report may link those local artifacts. Report unrun scenarios, missing transcripts, and model/host limitations. Do not infer a success rate or claim improvement from a single sample per task.

Use observed failures to change the owning skill, then run a fresh candidate. Keep previous evidence. Broader claims about wording require repeated matched samples; these smoke evals are not a benchmark of all artistic workflows or all models.
