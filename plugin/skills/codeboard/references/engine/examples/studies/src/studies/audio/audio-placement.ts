import { renderFramePNG } from "codeboard-studio";
import { amber, ink, make, rect, save, text } from "../../shared.ts";
export async function render(output: string): Promise<void> {
  const project = make("Audio placement diagram", 960, 400);
  const panel = project
    .addScene("Diagram")
    .addShot("Source and timeline")
    .addPanel({ durationFrames: 1 });
  const layer = panel.addVectorLayer("Diagram");
  text(layer, "Audio placement at 24 fps", 40, 45, 26);
  text(layer, "Source", 40, 114);
  text(layer, "Project", 40, 264);
  for (let second = 0; second <= 6; second++) {
    const x = 180 + second * 110;
    rect(layer, x, 130, 1, 20, ink);
    rect(layer, x, 280, 1, 20, ink);
    text(layer, `${second}s`, x - 9, 172, 16);
    text(layer, `${second}s`, x - 9, 322, 16);
  }
  rect(layer, 180, 90, 660, 40, "#d8cebb");
  rect(layer, 290, 90, 330, 40, amber);
  rect(layer, 400, 240, 330, 40, amber);
  text(layer, "Read source 1–4s", 320, 78, 18);
  text(layer, "Play at project 2–5s", 414, 226, 18);
  text(layer, "sourceInFrame: 24     startFrame: 48     durationFrames: 72", 180, 375, 18);
  await save(output, "audio-placement", project, await renderFramePNG(project, 0));
}
