import { pathCommands, renderFrameSheet } from "codeboard-studio";
import { amber, blue, make, save } from "../../shared.ts";
export async function render(output: string): Promise<void> {
  const project = make("Drawing changes and placement");
  const panel = project.addScene("Study").addShot("Two poses").addPanel({ durationFrames: 24 });
  const track = panel.addGroup("Drawing track");
  const a = panel.addVectorLayer("Triangle", {}, track.id);
  a.path(pathCommands("M -30 35 L 0 -40 L 30 35 Z"), { fill: amber });
  const b = panel.addVectorLayer("Diamond", {}, track.id);
  b.path(pathCommands("M -38 0 L 0 -45 L 38 0 L 0 45 Z"), { fill: blue });
  project.production.setDrawingSequence(track.id, [
    { frame: 0, drawingId: a.id },
    { frame: 12, drawingId: b.id },
  ]);
  project.production.addLayerKeyframe(track.id, 0, {
    transform: { x: 65, y: 140 },
    easing: "linear",
  });
  project.production.addLayerKeyframe(track.id, 23, { transform: { x: 295, y: 140 } });
  await save(
    output,
    "drawing-timing",
    project,
    await renderFrameSheet(project, [0, 5, 11, 12, 18, 23], { columns: 3, thumbnailWidth: 360 }),
  );
}
