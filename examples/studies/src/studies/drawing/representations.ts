import {
  brushes,
  catmullRom,
  createPixels,
  fillPixels,
  polygonPixelSelection,
  renderContactSheet,
} from "codeboard-studio";
import { ink, make, save } from "../../shared.ts";
export async function render(output: string): Promise<void> {
  const project = make("Editable representations");
  const shot = project.addScene("Study").addShot("Three representations");
  const path = catmullRom(
    [
      { x: 45, y: 205, pressure: 0.15 },
      { x: 140, y: 70, pressure: 1 },
      { x: 300, y: 150, pressure: 0.2 },
    ],
    32,
  );
  shot
    .addPanel({ title: "Replayable brush", durationFrames: 1 })
    .addRasterLayer("Paint")
    .rasterStroke(path, { ...brushes.charcoal, size: 34 }, { color: ink, seed: 17 });
  shot
    .addPanel({ title: "Vector stroke", durationFrames: 1 })
    .addVectorLayer("Contour")
    .vectorStroke(path, { width: 34, color: ink });
  const panel = shot.addPanel({ title: "Pixel surface", durationFrames: 1 });
  const pixels = createPixels(32, 24);
  fillPixels(pixels, [183, 117, 40, 255], {
    selection: polygonPixelSelection(32, 24, [
      { x: 3, y: 21 },
      { x: 14, y: 3 },
      { x: 29, y: 18 },
    ]),
  });
  panel.addRasterLayer("Pixels").rasterSurface(pixels, { matrix: [8, 0, 0, 8, 52, 40] });
  await save(
    output,
    "representations",
    project,
    await renderContactSheet(project, { columns: 3, thumbnailWidth: 360 }),
  );
}
