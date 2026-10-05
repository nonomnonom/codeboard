import { renderFramePNG } from "codeboard-studio";
import { make, rect, text, ink, amber, blue, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Compare the pace between keys", 480, 320);
  const panel = project
    .addScene("Timing")
    .addShot("Three easing curves")
    .addPanel({ durationFrames: 25 });
  const labels = panel.addVectorLayer("Track labels");
  for (const [index, easing] of ["linear", "ease-in-out", "hold"].entries()) {
    const y = 65 + index * 90;
    text(labels, easing, 20, y - 24, 18);
    rect(labels, 30, y + 18, 420, 1, ink);
    const marker = panel.addVectorLayer(easing);
    rect(marker, -12, -12, 24, 24, index === 1 ? blue : amber);
    project.production.addLayerKeyframe(marker.id, 0, {
      transform: { x: 45, y },
      easing: easing as "linear" | "ease-in-out" | "hold",
    });
    project.production.addLayerKeyframe(marker.id, 24, { transform: { x: 435, y } });
  }
  const samples = [];
  for (const frame of [0, 6, 18, 24])
    samples.push({
      label: `Frame ${frame}: compare the three positions`,
      png: await renderFramePNG(project, frame),
    });
  await save(
    output,
    "easing",
    project,
    await comparison(output, "Compare the pace between keys", samples, 2),
  );
}
