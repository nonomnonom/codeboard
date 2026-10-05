import type { Chapter } from "./types.ts";

export const assets: Chapter = {
  id: "assets",
  title: "Reuse and bring artwork in",
  introduction: "Compare what stays shared with what you can change in one copy.",
  lessons: [
    {
      id: "components",
      title: "One lamp, three placements",
      question: "Do you have to draw the lamp again at every size?",
      observe:
        "The lamps share their construction, but each has its own position and scale. Compare the shade, stem and base.",
      takeaway:
        "A reusable component supplies the drawing. Placed copies can have different transforms and local edits.",
      experiment:
        "Change the middle lamp's scale from 0.7 to 1.1. The other placements should stay put.",
      source: "assets/components.ts",
    },
    {
      id: "component-upgrade",
      title: "Update the shape, keep your paint",
      question: "What happens to a local color change when the source drawing changes?",
      observe:
        "Compare the original, the locally repainted version and the updated shape. The local paint survives the geometry update.",
      takeaway:
        "Updating a component can bring in source changes while preserving independent corrections in a copy.",
      experiment:
        "Choose a different local paint color and rerun the source upgrade. Compare the new shape and the retained color separately.",
      source: "assets/component-upgrade/render.ts",
    },
    {
      id: "psd-import",
      title: "Edit an imported pixel",
      question: "Can an imported image remain editable?",
      observe:
        "Compare the red area before and after import editing. The blue correction changes one source pixel, enlarged here so you can see it.",
      takeaway:
        "Supported PSD layers become native editable layers. The sample is intentionally tiny so one pixel is visible.",
      experiment:
        "Move the blue correction to a different source pixel and compare the enlarged result.",
      source: "assets/psd-import.ts",
    },
  ],
};
