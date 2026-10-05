# From a brief to an editable result

A Codeboard workflow keeps four activities distinct: authoring the initial work, saving its
editable state, reviewing rendered evidence, and revising the saved project. This lets a
second script or agent continue without rebuilding artwork that already contains corrections.

## Define the result

Record the subject, canvas size, duration or frame range, visual direction, supplied assets,
and required outputs. For a revision, also name the saved project, target objects, and what
may change. Make unknown decisions explicit instead of copying assumptions from a demo.

Choose the relevant workflow from [what Codeboard can do](../start/what-you-can-make.md). Check the installed
runtime's capabilities and any required media tools before depending on a particular format.

## Author a small editable piece

Create one panel or one shot before building a whole sequence. Give parts you expect to revise
stable IDs. Select vector, stroke, or pixel artwork according to the changes you need to make.
Type-check and run the authoring script, save the project, and render a frame for inspection.

The [quickstart](../start/first-drawing.md) provides a complete first script. The
[TypeScript setup](../start/typescript.md) covers its compiler and runtime configuration.

As a project grows, organize source around its responsibilities: configuration, reusable
artwork, shot construction, audio, review/export, and command entry points. A small example
does not need an extra framework or a directory for every function. Keep generated outputs
separate from source and from independently revised project files.

## Save the state you intend to keep

| Artifact | Role |
| --- | --- |
| TypeScript source | Authored construction logic, settings and explicit inputs |
| `.cboard` | Saved editable artwork, timing, project data and embedded media |
| Source assets and dependency lockfile | Inputs and environment needed to reproduce or extend the work |
| PNG, PDF or movie | A rendered view or delivery of selected project state |
| Receipt/review/job manifest | Evidence of the edit or snapshot used to produce an output |

Save before handing work to another process. Use named revisions for checkpoints, and keep
the original file when migrating an older project. Include external fonts and their permitted
use when handing off typography; a family name alone does not transfer a font file.

Read [projects and revisions](projects.md) for what each save, copy, migration and publish
operation preserves.

## Review the result at the right scale

For an illustration, inspect the full composition and relevant details. For animation, inspect
key poses, intermediate frames, camera framing and motion at playback speed. Contact sheets
and onion skins answer different questions; neither replaces watching the final timing.

Use exact frames and name the source revision in findings. Pixel differences can prove that
an image changed. Visual review determines whether the intended correction works. Keep
technical checks and artistic decisions separate.

Read [review tools](review.md) to choose a view that answers the question about your artwork.

## Revise the current saved project

Open the latest `.cboard`, inspect the intended target, and apply the smallest change that
fulfills the request. Render the affected frames again and check that unrelated content
remains intact.

For retryable agent work, prepare a normalized plan against a saved version and commit it
with a request ID. If the saved base has changed, inspect the new state and create a new plan.
If a request may already have committed, read/replay its receipt instead of applying a second
independent edit. See [agent workflow](working-with-an-agent.md) for the actual commands and contracts.

An authoring generator owns only its designated outputs. Rerunning an older generator over
an independently edited project can replace those corrections. Rendering an existing project
should read its saved state.

## Assemble and deliver

For a storyboard, arrange panel durations on the board timeline. For reusable animation,
keep keys and drawing holds local to shots and place source ranges in an editorial sequence.
Keep audio source samples distinct from those frame positions.

Render the chosen snapshot and output profile. For a movie, check actual duration, frame rate,
framing, and sound synchronization. For transparent assets, inspect edges against the intended
background. Frame jobs can resume checked output; they do not decide that the artwork is finished.

Use [export](../delivery/export.md), [audio](../audio/board-audio.md), and the supported [editorial interchange](../animation/otio.md)
when selecting a delivery format.

## Hand off enough to continue

Provide the saved project and version, source and dependencies, relevant asset/font pins,
commands to run, review findings, and requested next change. Identify which outputs are
generated and which saved files contain independent edits. The next author should be able
to inspect a target and revise it without relying on the previous chat history.

Validate the actual production's shots, audio, assets and outputs. A successful API call establishes that an operation completed; visual and playback review determine whether it satisfies the brief.
