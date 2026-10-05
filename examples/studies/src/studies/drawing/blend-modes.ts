import { renderFramePNG, type BlendMode } from "codeboard-studio";
import { make, rect, amber, blue, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Mix overlapping colors");
  const shot = project.addScene("Blends").addShot("Same two rectangles");
  const samples = [];
  for (const blendMode of [
    "source-over",
    "multiply",
    "screen",
    "overlay",
    "darken",
    "lighten",
  ] satisfies BlendMode[]) {
    const panel = shot.addPanel({ durationFrames: 1 });
    rect(panel.addVectorLayer("Amber underneath"), 55, 55, 165, 145, amber);
    rect(panel.addVectorLayer("Blue over it", { blendMode }), 145, 110, 160, 120, blue);
    samples.push({
      label:
        blendMode === "source-over"
          ? "Normal: blue covers amber"
          : `${blendMode}: inspect the overlap`,
      png: await renderFramePNG(project, samples.length),
    });
  }
  await save(
    output,
    "blend-modes",
    project,
    await comparison(output, "Mix overlapping colors", samples),
  );
}
