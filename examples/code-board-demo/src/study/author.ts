import { StoryboardProject } from "codeboard-studio";
import { colors, drawClawd, ground, obstacle } from "../character/art.ts";
import { config } from "../config.ts";
import { acting } from "../character/poses.ts";
export function createDemo() {
  const project = StoryboardProject.create({ ...config, background: colors.bg });
  project.transaction("Draw the performance", () => {
    const panel = project
      .addScene("The obstacle", "street")
      .addShot("One considered hop", "hop")
      .addPanel({
        id: "performance",
        title: "Walk, notice, hop, land",
        durationFrames: 192,
        action: "Clawd notices a line, gathers weight, hops across, and settles.",
      });
    ground(panel, 100, 1810, 800);
    obstacle(panel, 1271, 800);
    const stage = panel.addGroup("Stage", {
      id: "stage",
      transform: { x: -120, y: 800, scaleX: 1.3, scaleY: 1.3 },
    });
    const track = panel.addGroup("Clawd drawings", { id: "clawd" }, stage.id);
    const drawings = new Map<string, string>();
    for (const [name, pose] of acting.drawings) {
      drawings.set(name, drawClawd(panel, pose, { parent: track.id, name }).id);
    }
    project.production.setDrawingSequence(
      track.id,
      acting.exposures.map(({ frame, id }) => {
        const drawingId = drawings.get(id);
        if (!drawingId) throw new Error(`Unknown exposure drawing ${id}`);
        return { frame, drawingId };
      }),
    );
    for (const { frame, x, y } of acting.exposures) {
      project.production.addLayerKeyframe(track.id, frame, { transform: { x, y }, easing: "hold" });
    }
  });
  return project;
}
