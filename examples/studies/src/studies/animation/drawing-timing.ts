import { pathCommands, renderFramePNG } from "codeboard-studio";
import { amber, blue, make, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";
export async function generate(output: string): Promise<void> {
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
    await comparison(
      output,
      "Swap the drawing while it moves",
      await Promise.all(
        [0, 5, 11, 12, 18, 23].map(async (frame) => ({
          label: `Frame ${frame}: ${frame < 12 ? "triangle" : "diamond"}${frame === 11 ? ", just before the switch" : frame === 12 ? ", the switch" : ""}`,
          png: await renderFramePNG(project, frame),
        })),
      ),
    ),
  );
}
