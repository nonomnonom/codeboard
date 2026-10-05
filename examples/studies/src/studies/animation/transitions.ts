import { renderFramePNG } from "codeboard-studio";
import { make, rect, amber, blue, ink, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Compare the change between pictures");
  const shot = project.addScene("Edit").addShot("Two pictures");
  const first = shot.addPanel({ durationFrames: 24 });
  const second = shot.addPanel({ durationFrames: 24 });
  const a = first.addVectorLayer("First picture");
  rect(a, 0, 0, 360, 280, amber);
  rect(a, 50, 70, 65, 140, ink);
  const b = second.addVectorLayer("Second picture");
  rect(b, 0, 0, 360, 280, blue);
  rect(b, 245, 70, 65, 140, "white");
  const samples = [];
  for (const type of ["cut", "dissolve", "wipe-left", "wipe-right"] as const) {
    project.production.setTransition(first.id, { type, durationFrames: type === "cut" ? 0 : 12 });
    samples.push({
      label: `${type}: frame 18 of the same edit`,
      png: await renderFramePNG(project, 18),
    });
  }
  await save(
    output,
    "transitions",
    project,
    await comparison(output, "Compare the change between pictures", samples, 2),
  );
}
