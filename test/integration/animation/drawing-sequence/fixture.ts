import { StoryboardProject, pathCommands } from "../../../../src/index.js";

export function setup() {
  const p = StoryboardProject.create({
    title: "Reusable drawings",
    width: 80,
    height: 60,
    background: "transparent",
  });
  const shot = p.addScene("S").addShot("S"),
    panel = shot.addPanel({ durationFrames: 12 }),
    later = shot.addPanel({ durationFrames: 4 });
  const track = panel.addGroup("Character", { transform: { x: 5 } }),
    a = panel.addVectorLayer("A", {}, track.id),
    b = panel.addGroup("B", {}, track.id);
  a.path(pathCommands("M 5 20 L 15 20 L 15 40 L 5 40 Z"), { fill: "red" });
  panel
    .addVectorLayer("B ink", {}, b.id)
    .path(pathCommands("M 25 20 L 35 20 L 35 40 L 25 40 Z"), { fill: "blue" });
  p.production.setDrawingSequence(track.id, [
    { frame: 2, drawingId: a.id },
    { frame: 4, drawingId: b.id },
    { frame: 6, drawingId: a.id },
    { frame: 8, drawingId: null },
  ]);
  return { p, shot, panel, later, track, a, b };
}
