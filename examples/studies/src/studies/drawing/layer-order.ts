import { renderPanelPNG } from "codeboard-studio";
import { make, rect, amber, blue, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Change overlap and parent space");
  const panel = project.addScene("Layers").addShot("Two cards").addPanel();
  const group = panel.addGroup("Offset parent", { transform: { x: 40, y: -30 } });
  const back = panel.addVectorLayer("Amber card");
  const front = panel.addVectorLayer("Blue card");
  rect(back, 60, 80, 170, 140, amber);
  rect(front, 150, 110, 140, 100, blue);
  const samples = [
    { label: "Blue starts above amber", png: await renderPanelPNG(project, panel.id) },
  ];
  project.production.moveLayer(front.id, back.id);
  samples.push({
    label: "Move blue earlier: amber now overlaps it",
    png: await renderPanelPNG(project, panel.id),
  });
  project.production.reparentLayer(front.id, group.id);
  samples.push({
    label: "Reparent blue: its new parent shifts it right and up",
    png: await renderPanelPNG(project, panel.id),
  });
  await save(
    output,
    "layer-order",
    project,
    await comparison(output, "Change overlap and parent space", samples),
  );
}
