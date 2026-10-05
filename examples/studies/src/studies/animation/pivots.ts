import { renderFramePNG } from "codeboard-studio";
import { make, rect, ink, amber, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Choose where a shape turns");
  const shot = project.addScene("Pivots").addShot("A turning plank");
  const samples = [];
  for (const [label, pivot, rotation] of [
    ["Original plank", { x: 0, y: 0 }, 0],
    ["Turn around the left end", { x: 0, y: 0 }, -0.6],
    ["Turn around the center", { x: 80, y: 0 }, -0.6],
  ] as const) {
    const panel = shot.addPanel({ durationFrames: 1 });
    const plank = panel.addVectorLayer("Plank", { pivot, transform: { x: 100, y: 150, rotation } });
    rect(plank, 0, -18, 160, 36, amber);
    const marker = panel.addVectorLayer("Pivot marker");
    const x = 100 + pivot.x;
    marker.vectorStroke(
      [
        { x: x - 8, y: 150 },
        { x: x + 8, y: 150 },
      ],
      { width: 3, color: ink },
    );
    marker.vectorStroke(
      [
        { x, y: 142 },
        { x, y: 158 },
      ],
      { width: 3, color: ink },
    );
    samples.push({ label, png: await renderFramePNG(project, samples.length) });
  }
  await save(
    output,
    "pivots",
    project,
    await comparison(output, "Choose where a shape turns", samples),
  );
}
