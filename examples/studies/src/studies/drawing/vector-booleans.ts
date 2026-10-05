import { pathCommands, combinePaths, renderFramePNG } from "codeboard-studio";
import { make, amber, blue, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Cut and combine contours");
  const shot = project.addScene("Contours").addShot("Overlapping shapes");
  const a = pathCommands("M 60 70 L 220 70 L 220 210 L 60 210 Z");
  const b = pathCommands("M 145 35 L 300 140 L 145 245 Z");
  const samples = [];
  const original = shot.addPanel({ durationFrames: 1 });
  original.addVectorLayer("First shape").path(a, { fill: amber });
  original.addVectorLayer("Tool shape", { opacity: 0.6 }).path(b, { fill: blue });
  samples.push({
    label: "Start with two overlapping shapes",
    png: await renderFramePNG(project, 0),
  });
  for (const [operation, label] of [
    ["union", "Union: keep either shape"],
    ["intersect", "Intersect: keep only the overlap"],
    ["difference", "Difference: cut the triangle out"],
    ["xor", "XOR: remove the shared area"],
  ] as const) {
    shot
      .addPanel({ durationFrames: 1 })
      .addVectorLayer(operation)
      .path(combinePaths(a, b, operation), { fill: amber });
    samples.push({ label, png: await renderFramePNG(project, samples.length) });
  }
  await save(
    output,
    "vector-booleans",
    project,
    await comparison(output, "Cut and combine contours", samples, 2),
  );
}
