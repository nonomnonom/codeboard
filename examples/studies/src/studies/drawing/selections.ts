import {
  createPixels,
  featherPixelSelection,
  fillPixels,
  polygonPixelSelection,
  renderContactSheet,
} from "codeboard-studio";
import { make, save } from "../../shared.ts";
export async function render(output: string): Promise<void> {
  const project = make("Pixel selections");
  const shot = project.addScene("Study").addShot("Source resolution");
  for (const [title, feather] of [
    ["Hard selection", 0],
    ["Feather: sigma 8 px", 8],
  ] as const) {
    const panel = shot.addPanel({ title, durationFrames: 1 });
    const image = createPixels(256, 220);
    let selection = polygonPixelSelection(256, 220, [
      { x: 20, y: 190 },
      { x: 128, y: 20 },
      { x: 236, y: 190 },
    ]);
    if (feather) selection = await featherPixelSelection(selection, feather);
    fillPixels(image, [183, 117, 40, 255], { selection });
    panel.addRasterLayer("Selection").rasterSurface(image, { matrix: [1, 0, 0, 1, 52, 30] });
  }
  await save(
    output,
    "selections",
    project,
    await renderContactSheet(project, { columns: 2, thumbnailWidth: 480 }),
  );
}
