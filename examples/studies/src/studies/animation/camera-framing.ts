import { pathCommands, renderFramePNG } from "codeboard-studio";
import { make, rect, amber, blue, ink, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Move the view, keep the drawing");
  const shot = project.addScene("Framing").addShot("A lamp in a room");
  const panel = shot.addPanel({ durationFrames: 25 });
  const art = panel.addVectorLayer("Fixed room artwork");
  rect(art, 25, 35, 100, 130, blue);
  rect(art, 0, 230, 360, 4, ink);
  rect(art, 240, 100, 8, 120, ink);
  art.path(pathCommands("M 208 100 L 222 58 L 266 58 L 280 100 Z"), { fill: amber });
  project.production.addCameraKeyframe(shot.id, 0, { x: 0, y: 0, zoom: 1, rotation: 0 });
  project.production.addCameraKeyframe(shot.id, 12, { x: 64, y: 0, zoom: 1, rotation: 0 });
  project.production.addCameraKeyframe(shot.id, 24, { x: 64, y: -5, zoom: 1.7, rotation: 0 });
  await save(
    output,
    "camera-framing",
    project,
    await comparison(output, "Move the view, keep the drawing", [
      { label: "Wide view: window and lamp", png: await renderFramePNG(project, 0) },
      { label: "Pan right: the lamp moves toward center", png: await renderFramePNG(project, 12) },
      { label: "Zoom closer to the lamp", png: await renderFramePNG(project, 24) },
    ]),
  );
}
