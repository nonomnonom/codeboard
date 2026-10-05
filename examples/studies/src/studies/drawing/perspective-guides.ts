import { pathCommands, renderFramePNG, renderCompositionGuides } from "codeboard-studio";
import { make, rect, ink, amber, blue, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Draw toward a vanishing point");
  const panel = project.addScene("Room").addShot("One-point construction").addPanel();
  const art = panel.addVectorLayer("Authored room geometry");
  art.path(pathCommands("M 0 280 L 180 90 L 360 280 Z"), { fill: "#dfcfb5" });
  for (const x of [0, 75, 140, 220, 285, 360])
    art.vectorStroke(
      [
        { x: 180, y: 90 },
        { x, y: 280 },
      ],
      { color: ink, width: 1.5 },
    );
  for (const y of [122, 150, 190, 244]) {
    const halfWidth = ((y - 90) / 190) * 180;
    art.vectorStroke(
      [
        { x: 180 - halfWidth, y },
        { x: 180 + halfWidth, y },
      ],
      { color: blue, width: 2 },
    );
  }
  rect(art, 144, 54, 72, 36, amber);
  await save(
    output,
    "perspective-guides",
    project,
    await comparison(output, "Draw toward a vanishing point", [
      { label: "Authored floor lines meet in the distance", png: await renderFramePNG(project, 0) },
      {
        label: "Locate the horizon",
        png: await renderCompositionGuides(project, panel.id, { thirds: false, horizonY: 90 }),
      },
      {
        label: "Check against the vanishing-point guide",
        png: await renderCompositionGuides(project, panel.id, {
          thirds: false,
          horizonY: 90,
          vanishingPoints: [{ x: 180, y: 90 }],
        }),
      },
    ]),
  );
}
