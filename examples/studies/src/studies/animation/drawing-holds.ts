import { pathCommands, renderFramePNG } from "codeboard-studio";
import { make, amber, blue, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Hold a drawing, leave a blank");
  const panel = project
    .addScene("Exposures")
    .addShot("A blinking mark")
    .addPanel({ durationFrames: 24 });
  const track = panel.addGroup("Drawing track");
  const open = panel.addVectorLayer("Open eye", {}, track.id);
  open.path(pathCommands("M 60 140 Q 180 30 300 140 Q 180 250 60 140 Z"), { fill: amber });
  const closed = panel.addVectorLayer("Closed eye", {}, track.id);
  closed.vectorStroke(
    [
      { x: 60, y: 140 },
      { x: 300, y: 140 },
    ],
    { width: 8, color: blue },
  );
  project.production.setDrawingSequence(track.id, [
    { frame: 0, drawingId: open.id },
    { frame: 8, drawingId: closed.id },
    { frame: 12, drawingId: null },
    { frame: 16, drawingId: open.id },
  ]);
  const samples = [];
  for (const [frame, label] of [
    [0, "Frame 0: open drawing"],
    [7, "Frame 7: still the same held drawing"],
    [8, "Frame 8: switch to closed"],
    [12, "Frame 12: a deliberate blank"],
    [16, "Frame 16: the open drawing returns"],
  ] as const)
    samples.push({ label, png: await renderFramePNG(project, frame) });
  await save(
    output,
    "drawing-holds",
    project,
    await comparison(output, "Hold a drawing, leave a blank", samples, 2),
  );
}
