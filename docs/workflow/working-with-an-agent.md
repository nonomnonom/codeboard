# Make artwork with a coding agent

Describe what you want to make, let your agent run Codeboard, and review the rendered result. The agent writes and executes the authoring code; you provide the subject, visual direction and feedback.

## Set up your workspace

[Install Codeboard and its agent skills](../start/agent-setup.md), then open your agent in the folder where you want to keep the artwork. The engine must be installed in the environment where the agent runs commands. For a remote agent, that may be a container rather than your computer.

## Describe the first result

Include the subject, style, canvas ratio, duration and files you want back. For example:

> Use Codeboard to make a three-panel storyboard of a person noticing a light and reaching for it. Use a 16:9 canvas, rough pencil lines and separate layers for the person and background. Start with the first panel and show me the PNG. Keep the source and editable project in this folder.

If you have reference images or existing assets, identify them in the brief. For animation, describe the important poses and the pacing rather than asking only for a finished movie.

## Review one small piece

Start with one drawing or one shot. Inspect the full image, then a detail view of anything that needs correction. For movement, watch playback as well as individual poses. A contact sheet helps compare compositions; an onion skin helps compare positions across frames.

Ask for a concrete revision:

> In panel two, keep the body and background as they are. Lower the reaching hand slightly and show the before/after crop. Save the revised project separately from the first version.

For timing:

> Hold the anticipation two frames longer. Check which later panels and audio cues move, then show the affected frames and updated playback.

The [review guide](review.md) explains the available views.

## Turn feedback into a specific operation

| Feedback | Edit | Review evidence |
| --- | --- | --- |
| “The foot slides” | Adjust the drawing's foot geometry or placement keys during contact | Consecutive frames against a fixed ground line |
| “Hold before the jump” | Extend a drawing range, or ripple-retime the panel if later timing should move | Before/after playback and the exposure list |
| “Move the camera closer” | Update the shot camera's zoom and pan keys | Start, midpoint, and end frame |
| “Only this hand is wrong” | Edit its contour or replace that drawing | Cropped before/after at the same frame |
| “Use a softer pencil” | Test a derived brush, then explicitly edit selected old strokes | Swatch and artwork detail |
| “Delay the sound” | Update the audio clip start frame | Playback around the contact frame |

## Keep the work editable

Ask for the authoring source, input assets and saved `.cboard`, along with the PNG, PDF or movie. Once you have revised a saved project, use that file for the next revision. Rerunning an older generator can replace the corrections.

When continuing later, give the agent the project path and the outstanding feedback. Include the latest review request and identify files containing independent edits. For scripts that may retry after a timeout, use [saved edit plans](../reference/edit-plans.md).

Codeboard runs scripts with the executing account's permissions. Review unfamiliar scripts before running them. It does not supply a model, chat account or agent scheduler.
