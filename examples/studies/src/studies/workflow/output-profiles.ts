import { join } from "node:path";
import { createFrameJob, runFrameJob, readFrameJobFrame } from "codeboard-studio";
import { make, rect, amber, blue, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Fit one picture into a wide frame");
  const panel = project
    .addScene("Delivery")
    .addShot("Aspect ratio")
    .addPanel({ durationFrames: 1 });
  const art = panel.addVectorLayer("Picture");
  rect(art, 20, 20, 320, 240, blue);
  rect(art, 110, 70, 140, 140, amber);
  project.capturePanelAnimation(panel.id, { id: "animation:profile" });
  const source = join(output, "output-profiles.cboard");
  await project.save(source);
  const samples = [];
  for (const [fit, label] of [
    ["contain", "Contain: retain the picture and add side padding"],
    ["cover", "Cover: crop the top and bottom"],
    ["fill", "Fill: stretch the square into a rectangle"],
  ] as const) {
    const job = join(output, `${fit}.sqlite`);
    createFrameJob(source, job, {
      expectedVersion: project.version,
      target: { kind: "shot", animationId: "animation:profile" },
      outputProfile: {
        width: 480,
        height: 240,
        fit,
        alpha: "flatten",
        background: { r: 36, g: 36, b: 36 },
      },
    });
    await runFrameJob(job);
    samples.push({ label, png: readFrameJobFrame(job, 0) });
  }
  await save(
    output,
    "output-profiles",
    project,
    await comparison(output, "Fit one picture into a wide frame", samples),
  );
}
