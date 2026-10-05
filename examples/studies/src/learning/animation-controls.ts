import type { Chapter } from "./types.ts";

export const animationControls: Chapter = {
  id: "animation-controls",
  title: "Time, framing and review",
  introduction: "Compare positions at known frames before watching the motion.",
  lessons: [
    {
      id: "transitions",
      title: "Compare the change between pictures",
      question: "How does one picture give way to another?",
      observe: "Compare the same edit frame under cut, dissolve and the two wipe directions.",
      takeaway: "A transition changes how adjacent pictures combine over time.",
      experiment: "Move the sampled frame nearer the beginning and end of the transition.",
      source: "animation/transitions.ts",
    },
    {
      id: "onion-skin",
      title: "See neighboring poses together",
      question: "Is the motion moving along the intended path?",
      observe:
        "The solid ball is current. Blue shows an earlier position and translucent amber shows a later one.",
      takeaway:
        "Onion skins are review overlays; the exported animation contains only the current ball.",
      experiment: "Choose frames closer to the current frame and compare the spacing.",
      source: "animation/onion-skin.ts",
    },
    {
      id: "easing",
      title: "Compare the pace between keys",
      question: "Can the same endpoints produce different movement?",
      observe:
        "Compare the three markers at the same numbered frame. The hold marker waits until its final key.",
      takeaway: "Easing changes progress between keys without changing their endpoints.",
      experiment: "Replace ease-in-out with ease-in and compare the first quarter.",
      source: "animation/easing.ts",
    },
    {
      id: "pivots",
      title: "Choose where rotation happens",
      question: "Why does the same angle move an object differently?",
      observe: "Follow the cross marking the rotation center as the plank turns.",
      takeaway: "The pivot determines the point around which the layer rotates.",
      experiment: "Move the pivot to the far end of the plank.",
      source: "animation/pivots.ts",
    },
    {
      id: "stroke-reveal",
      title: "Draw a stroke over time",
      question: "How does a finished gesture appear gradually?",
      observe: "Follow the growing stroke from its first frame to the completed path.",
      takeaway: "Stroke reveal controls how much of the authored path is visible over time.",
      experiment: "Double the reveal duration while keeping the path unchanged.",
      source: "animation/stroke-reveal.ts",
    },
    {
      id: "drawing-holds",
      title: "Hold, change and leave a blank",
      question: "What is visible between drawing keys?",
      observe:
        "The open eye holds, the closed eye replaces it, then the explicitly blank exposure removes it.",
      takeaway: "A drawing key holds until the next key; a blank exposure is an authored state.",
      experiment: "Lengthen the closed-eye exposure by moving the next key.",
      source: "animation/drawing-holds.ts",
    },
    {
      id: "camera-framing",
      title: "Move the view, keep the drawing",
      question: "How does a camera bring attention to one object?",
      observe: "Compare the window and lamp as the camera pans right and zooms in.",
      takeaway: "Camera keys change the view of stationary artwork.",
      experiment: "Change only the final zoom and check whether the lamp remains visible.",
      source: "animation/camera-framing.ts",
    },
    {
      id: "retiming",
      title: "Give the movement more time",
      question: "What changes when a shot lasts twice as long?",
      observe: "Compare both versions at frame 12, then compare the slower version at frame 24.",
      takeaway: "Retiming moves keys to a new time scale; it does not redraw the movement.",
      experiment: "Try a shorter duration and inspect the new key positions.",
      source: "animation/retiming.ts",
    },
  ],
};
