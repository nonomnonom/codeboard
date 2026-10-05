import { renderPanelPNG } from "codeboard-studio";
import { motion } from "../../shared/motion.ts";
import { save, blue } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const { project, panel } = motion("Explain a move on the board");
  panel.addMotion("Travel right", { x: 80, y: 110 }, { x: 280, y: 110 }, blue);
  await save(
    output,
    "motion-notes",
    project,
    await comparison(output, "Explain a move on the board", [
      {
        label: "Artwork without the board note",
        png: await renderPanelPNG(project, panel.id, { frame: 0, annotations: false }),
      },
      {
        label: "The arrow explains the intended movement",
        png: await renderPanelPNG(project, panel.id, { frame: 0, annotations: true }),
      },
    ]),
  );
}
