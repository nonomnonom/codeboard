import { StoryboardProject } from "../core/project.js";
import { renderPanelPNG } from "../render/panel.js";
import { catmullRom } from "./curve-sampling.js";
import type { BrushPreset } from "../model/types.js";

export async function renderBrushSwatch(
  brush: BrushPreset,
  options: { color?: string; background?: string } = {},
): Promise<Buffer> {
  const project = StoryboardProject.create({
    title: brush.name,
    width: 800,
    height: 300,
    background: options.background ?? "#eee8dc",
  });
  let id = "";
  project.transaction("Brush evaluation", () => {
    const panel = project.addScene("Swatches").addShot("Pressure curve").addPanel();
    id = panel.id;
    const raster = panel.addRasterLayer("Brush sample");
    raster.rasterStroke(
      catmullRom(
        [
          { x: 45, y: 170, pressure: 0.1 },
          { x: 200, y: 65, pressure: 0.8 },
          { x: 410, y: 215, pressure: 1 },
          { x: 625, y: 85, pressure: 0.5 },
          { x: 755, y: 160, pressure: 0.1 },
        ],
        16,
      ),
      brush,
      { color: options.color ?? "#171c20" },
    );
  });
  return renderPanelPNG(project, id, { annotations: false });
}
