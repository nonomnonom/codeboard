import type { Chapter } from "./types.ts";

export const workflow: Chapter = {
  id: "workflow",
  title: "Revise and deliver the work",
  introduction:
    "Look for the intended change, or for an image that should stay identical. Technical reports are available after the visual explanation.",
  lessons: [
    {
      id: "output-profiles",
      title: "Fit one picture into a wide frame",
      question: "What should happen when the output shape changes?",
      observe: "Compare side padding, cropped edges and the stretched central square.",
      takeaway: "Contain, cover and fill are different output choices, applied by real frame jobs.",
      experiment: "Change the output to a tall frame and compare the three policies.",
      source: "workflow/output-profiles.ts",
    },
    {
      id: "render-passes",
      title: "Separate a prop from its background",
      question: "Can one object be processed independently?",
      observe:
        "The isolated prop has no ground. The final image combines the desaturated prop with the original ground.",
      takeaway:
        "Layer selection creates a transparent pass; a saved graph can grade and combine passes.",
      experiment: "Grade only the prop with a brightness effect.",
      source: "workflow/render-passes.ts",
    },
    {
      id: "saved-revision",
      title: "Try a change and return to the original",
      question: "Can you recover the drawing before an edit?",
      observe:
        "The prop becomes translucent in the middle image. The restored image returns to the opaque original.",
      takeaway: "A saved checkpoint lets you return to an earlier state after making a change.",
      experiment: "Use an opacity of 0.5 instead of 0.25, then restore the same checkpoint.",
      source: "workflow/saved-revision.ts",
    },
    {
      id: "review-tools",
      title: "See motion without changing the drawing",
      question: "What can review overlays reveal?",
      observe:
        "Compare the clean frame with composition guides and then the ghosted positions. The ghosts show where the prop was and where it is going.",
      takeaway:
        "Review overlays add information to an exported view while leaving the source artwork alone.",
      experiment:
        "Choose a different center frame for the onion skin. Compare the spacing between ghosted positions.",
      source: "workflow/review-tools.ts",
    },
    {
      id: "font-preflight",
      title: "Keep the title you intended",
      question: "What changes when the requested font is missing?",
      observe:
        "All samples say 'Field notes'. Compare letter shapes and spacing in the fallback, the chosen serif and the bundled font.",
      takeaway:
        "A fallback can keep text visible while changing its appearance. Checking or bundling a font makes the choice explicit.",
      experiment: "Change the title to a longer phrase and compare line width in each font.",
      source: "workflow/font-preflight.ts",
    },
    {
      id: "frame-jobs",
      title: "Continue an interrupted render",
      question: "Must a stopped render start again from the first frame?",
      observe:
        "The first two samples were already rendered. The last comes from the resumed job. Their captions identify which work was kept.",
      takeaway:
        "The job retains completed frames and renders the remaining ones. Pictures show the output; the progress report records reuse.",
      experiment:
        "Stop after two completed frames instead of four. Inspect the resumed counts and the resulting images.",
      source: "workflow/frame-jobs.ts",
    },
    {
      id: "migration",
      title: "Open an older project without changing its look",
      question: "Does updating the file format change the drawing?",
      observe:
        "Compare each old frame with the converted frame next to it. Matching pairs are the intended result.",
      takeaway:
        "Migration writes a new project. These samples check that its selected frames preserve the old appearance.",
      experiment:
        "Compare another frame from the old and converted files before making a new edit.",
      source: "workflow/migration.ts",
    },
    {
      id: "project-publish",
      title: "Hand off a project with its assets",
      question: "Can the drawing survive when the original source paths disappear?",
      observe:
        "The first two images should match. The final image is an independent revision made in a working copy.",
      takeaway:
        "The handoff carries the required project assets. A separate working copy can then change without rewriting the delivery.",
      experiment: "Revise the working copy's opacity and compare it with the untouched handoff.",
      source: "workflow/project-publish.ts",
    },
    {
      id: "shot-merge",
      title: "Bring two edits back together",
      question: "What survives when two people change the same shot?",
      observe:
        "Compare the baseline, each separate edit and the merged result. First follow color and placement, then the local color correction and incoming opacity.",
      takeaway:
        "Independent changes can be combined. Conflicting changes need an explicit choice rather than silently replacing one person's work.",
      experiment:
        "Change the incoming opacity while keeping the local color correction, then compare the merged shot.",
      source: "workflow/shot-merge.ts",
    },
    {
      id: "otio-conform",
      title: "Rebuild a sequence from a cut list",
      question: "Which source picture appears at each point in an edit?",
      observe:
        "Read the samples in edit order. Each caption identifies the source shot and frame selected by the cut list.",
      takeaway:
        "The edit maps source ranges onto a timeline, including sources with different frame rates.",
      experiment:
        "Adjust one source-in value in the cut-list fixture and compare the first visible frame of that clip.",
      source: "workflow/otio-conform.ts",
    },
  ],
};
