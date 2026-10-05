import { StoryboardProject, brushes, catmullRom } from "codeboard-studio";
import { config } from "../config.ts";
export function author(): StoryboardProject {
  const project = StoryboardProject.create({
    ...config,
  });
  const panel = project.addScene("A mark").addShot("Close-up").addPanel({
    id: "first-stroke",
    durationFrames: config.durationFrames,
  });
  project.transaction("Draw a rising brush stroke", () => {
    panel.addRasterLayer("Ink", { id: "ink" }).rasterStroke(
      catmullRom(
        [
          { x: 150, y: 390, pressure: 0.2, time: 0 },
          { x: 360, y: 230, pressure: 1, time: 260 },
          { x: 600, y: 300, pressure: 0.8, time: 520 },
          { x: 800, y: 140, pressure: 0.12, time: 800 },
        ],
        32,
      ),
      { ...brushes.cleanInk, size: 44 },
      {
        color: "#191916",
        seed: 12,
        reveal: { startFrame: 0, endFrame: 36 },
      },
    );
  });
  return project;
}
