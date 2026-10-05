import { pathCommands, renderPanelPNG } from "codeboard-studio";
import { make, rect, amber, blue, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Reveal artwork through a mask");
  const panel = project.addScene("Mask").addShot("Window").addPanel();
  const paint = panel.addVectorLayer("Striped paint");
  for (let row = 0; row < 6; row++) rect(paint, 40, 40 + row * 32, 280, 32, row % 2 ? amber : blue);
  const original = await renderPanelPNG(project, panel.id);
  const mask = panel.addVectorLayer("Window mask", { visible: false });
  mask.path(pathCommands("M 80 220 L 80 100 Q 180 -5 280 100 L 280 220 Z"), { fill: "black" });
  paint.set({ maskLayerId: mask.id });
  const masked = await renderPanelPNG(project, panel.id);
  mask.set({ transform: { x: 55, y: 0, scaleX: 1, scaleY: 1, rotation: 0 } });
  await save(
    output,
    "masks",
    project,
    await comparison(output, "Reveal artwork through a mask", [
      { label: "The full striped artwork", png: original },
      { label: "A hidden arch masks the stripes", png: masked },
      {
        label: "Move the mask; the stripes stay still",
        png: await renderPanelPNG(project, panel.id),
      },
    ]),
  );
}
