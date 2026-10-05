import { pathCommands, renderPanelPNG } from "codeboard-studio";
import { make, amber, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Turn a stroke into editable geometry");
  const panel = project.addScene("Vector").addShot("Outline").addPanel();
  const layer = panel.addVectorLayer("Pressure stroke");
  const stroke = layer.vectorStroke(
    [
      { x: 50, y: 170, pressure: 0.4 },
      { x: 170, y: 95, pressure: 1 },
      { x: 310, y: 180, pressure: 0.4 },
    ],
    { width: 65, color: amber },
  );
  const samples = [
    { label: "A pressure-shaped vector stroke", png: await renderPanelPNG(project, panel.id) },
  ];
  layer.outlineStroke(stroke);
  samples.push({
    label: "Outlined contour keeps the silhouette",
    png: await renderPanelPNG(project, panel.id),
  });
  layer.booleanPath(stroke, pathCommands("M 155 40 L 195 40 L 195 230 L 155 230 Z"), "difference");
  samples.push({
    label: "Cut the filled contour with a rectangle",
    png: await renderPanelPNG(project, panel.id),
  });
  await save(
    output,
    "stroke-outline",
    project,
    await comparison(output, "Turn a stroke into editable geometry", samples),
  );
}
