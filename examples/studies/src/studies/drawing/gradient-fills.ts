import { pathCommands, renderFramePNG, type VectorFill } from "codeboard-studio";
import { make, amber, ink, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Shape a fill with color");
  const shot = project.addScene("Fills").addShot("One contour");
  const stops = [
    { offset: 0, color: "#ffe1a0" },
    { offset: 1, color: amber },
  ];
  const fills: [string, VectorFill][] = [
    ["Solid: one color throughout", amber],
    [
      "Linear: color changes from left to right",
      { kind: "linear", from: { x: 70, y: 80 }, to: { x: 290, y: 80 }, stops },
    ],
    [
      "Radial: color spreads from a center",
      {
        kind: "radial",
        from: { x: 145, y: 100, radius: 0 },
        to: { x: 145, y: 100, radius: 160 },
        stops,
      },
    ],
  ];
  const samples = [];
  for (const [label, fill] of fills) {
    const panel = shot.addPanel({ durationFrames: 1 });
    panel
      .addVectorLayer("Same contour")
      .path(pathCommands("M 70 90 Q 180 10 290 90 L 260 220 L 100 220 Z"), {
        fill,
        stroke: ink,
        strokeWidth: 2,
      });
    samples.push({ label, png: await renderFramePNG(project, samples.length) });
  }
  await save(
    output,
    "gradient-fills",
    project,
    await comparison(output, "Shape a fill with color", samples),
  );
}
