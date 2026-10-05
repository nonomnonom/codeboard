import { drawingTechniques } from "./drawing-techniques.ts";
import { animationControls } from "./animation-controls.ts";
import { drawing } from "./drawing.ts";
import { animation } from "./animation.ts";
import { assets } from "./assets.ts";
import { story } from "./story.ts";
import { audio } from "./audio.ts";
import { workflow } from "./workflow.ts";

export const chapters = [
  drawing,
  drawingTechniques,
  animationControls,
  animation,
  assets,
  story,
  audio,
  workflow,
];
export const lessons = chapters.flatMap((chapter) => chapter.lessons);
