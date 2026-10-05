import { StoryboardProject, createPixels } from "../../../../src/index.js";

export function fixture() {
  const project = StoryboardProject.create({
    title: "Transaction isolation",
    width: 64,
    height: 64,
  });
  const shot = project.addScene("Scene").addShot("Shot");
  const first = shot.addPanel({ id: "first", durationFrames: 24 }),
    second = shot.addPanel({ id: "second", durationFrames: 24 });
  const ink = first.addVectorLayer("Ink"),
    id = ink.vectorStroke(
      [
        { x: 4, y: 4 },
        { x: 48, y: 48 },
      ],
      { width: 6 },
    );
  const paint = second.addRasterLayer("Pixels");
  paint.rasterSurface(createPixels(64, 64));
  return { project, first, second, ink, id };
}
