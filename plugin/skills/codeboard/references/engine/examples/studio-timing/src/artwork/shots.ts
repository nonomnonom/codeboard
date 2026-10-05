import type { StoryboardProject } from "codeboard-studio";
import { config } from "../config.ts";

export function authorShots(project: StoryboardProject) {
  const scene = project.addScene("Two timing studies");
  return ["ochre", "teal"].map((name, index) => {
    const panel = scene.addShot(name).addPanel({ durationFrames: config.sourceFrames });
    const layer = panel.addVectorLayer("Moving marker");
    layer.path(
      [
        { op: "M", x: 24, y: 64 },
        { op: "L", x: 64, y: 64 },
        { op: "L", x: 64, y: 104 },
        { op: "L", x: 24, y: 104 },
        { op: "Z" },
      ],
      { fill: index === 0 ? "#ad651b" : "#16776d" },
    );
    const start = index * config.sourceFrames;
    project.production.addLayerKeyframe(layer.id, start, { transform: { x: 0 } });
    project.production.addLayerKeyframe(layer.id, start + config.sourceFrames - 1, {
      transform: { x: 220 },
      easing: "linear",
    });
    const id = `animation-${name}`;
    project.capturePanelAnimation(panel.id, { id });
    return id;
  });
}
