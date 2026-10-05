import { pathCommands, renderFramePNG } from "codeboard-studio";
import { amber, make, rect, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Keep the paint inside");
  const shot = project.addScene("Clipping").addShot("The same coat and highlight");
  for (const [title, clipped] of [
    ["The coat before highlights", null],
    ["Paint spills past the edge", false],
    ["Clipping keeps paint inside", true],
  ] as const) {
    const panel = shot.addPanel({ title, durationFrames: 1 });
    const base = panel.addVectorLayer("Coat silhouette");
    base.path(pathCommands("M 70 230 L 95 75 Q 180 15 265 75 L 290 230 Z"), { fill: amber });
    if (clipped !== null) {
      const highlight = panel.addVectorLayer("Highlight", { clipToBelow: clipped });
      rect(highlight, 30, 100, 300, 42, "#f7ce7f");
      rect(highlight, 30, 166, 300, 24, "#f7ce7f");
    }
  }
  await save(
    output,
    "clipping",
    project,
    await comparison(output, "Keep the paint inside", [
      { label: "Start with the coat silhouette", png: await renderFramePNG(project, 0) },
      { label: "Add highlights: paint spills out", png: await renderFramePNG(project, 1) },
      { label: "Turn clipping on: paint stays inside", png: await renderFramePNG(project, 2) },
    ]),
  );
}
