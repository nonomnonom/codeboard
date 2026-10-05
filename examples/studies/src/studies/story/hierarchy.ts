import { renderFramePNG } from "codeboard-studio";
import { amber, make, save, text } from "../../shared.ts";
export async function render(output: string): Promise<void> {
  const project = make("Project hierarchy diagram", 960, 500);
  const panel = project.addScene("Diagram").addShot("Ownership").addPanel({ durationFrames: 1 });
  const layer = panel.addVectorLayer("Diagram");
  text(layer, "From a project to editable artwork", 40, 48, 28);
  const entries = [
    ["Project", "Canvas defaults, frame rate, assets"],
    ["Sequence / scene", "Organize the story"],
    ["Shot", "Ordered panels and camera keys"],
    ["Panel", "Duration, captions and artwork"],
    ["Group / layer", "Hierarchy, placement and composition"],
    ["Element", "Stroke, contour, text or pixel surface"],
  ] as const;
  entries.forEach(([name, description], i) => {
    const x = 48 + i * 28,
      y = 108 + i * 65;
    if (i)
      layer.vectorStroke(
        [
          { x: x - 15, y: y - 42 },
          { x: x - 15, y: y - 8 },
          { x: x - 3, y: y - 8 },
        ],
        { width: 2, color: amber },
      );
    text(layer, name, x, y, 22);
    text(layer, description, 430, y, 19);
  });
  await save(output, "hierarchy", project, await renderFramePNG(project, 0));
}
