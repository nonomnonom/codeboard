import type { Chapter } from "./types.ts";

export const story: Chapter = {
  id: "story",
  title: "Organize the story",
  introduction:
    "These diagrams explain structure and text. They do not generate illustrations from a script.",
  lessons: [
    {
      id: "motion-notes",
      title: "Explain a move on the board",
      question: "How can a still board communicate movement?",
      observe: "Only the second picture contains the labeled motion arrow.",
      takeaway: "A motion annotation describes intent. It does not animate the artwork.",
      experiment: "Change the arrow direction without changing any animation keys.",
      source: "story/motion-notes.ts",
    },
    {
      id: "hierarchy",
      title: "Where does a drawing live?",
      question: "How do scenes, shots, panels and layers fit together?",
      observe:
        "Read from the whole project toward individual artwork. Each level gives you a smaller part to organize or edit.",
      takeaway:
        "Story structure and drawing layers solve different problems. This is an explanatory diagram, not a rendered film.",
      experiment:
        "Open an example and find one scene, one shot, one panel and a layer inside that panel.",
      source: "story/hierarchy.ts",
    },
    {
      id: "script-board",
      title: "A script and a panel caption are separate",
      question: "Does editing a caption rewrite the script?",
      observe:
        "Read the dialogue in the source card, the staged caption and the revised caption. The source text stays unchanged.",
      takeaway:
        "Staging links script records to panels. A later caption edit changes the panel's text, not its original script record.",
      experiment:
        "Change the imported caption sentence and compare it with the source script card.",
      source: "story/script-board.ts",
    },
  ],
};
