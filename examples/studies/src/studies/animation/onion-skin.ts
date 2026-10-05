import { pathCommands, renderFramePNG, renderOnionSkin } from "codeboard-studio";
import { make, rect, ink, amber, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("See the arc between poses");
  const panel = project
    .addScene("Ball")
    .addShot("An authored arc")
    .addPanel({ durationFrames: 25 });
  rect(panel.addVectorLayer("Ground"), 20, 220, 320, 2, ink);
  const ball = panel.addVectorLayer("Ball");
  ball.path(pathCommands("M -18 0 Q -18 -18 0 -18 Q 18 -18 18 0 Q 18 18 0 18 Q -18 18 -18 0 Z"), {
    fill: amber,
  });
  for (const [frame, x, y] of [
    [0, 60, 200],
    [12, 180, 70],
    [24, 300, 200],
  ] as const)
    project.production.addLayerKeyframe(ball.id, frame, { transform: { x, y }, easing: "linear" });
  const current = { panelId: panel.id, frame: 12 };
  const previous = {
    panelId: panel.id,
    frame: 6,
    layerIds: [ball.id],
    tint: "#397783",
    opacity: 0.45,
  };
  const next = {
    panelId: panel.id,
    frame: 18,
    layerIds: [ball.id],
    tint: "#b77528",
    opacity: 0.45,
  };
  await save(
    output,
    "onion-skin",
    project,
    await comparison(output, "See the arc between poses", [
      { label: "Current frame: the top of the arc", png: await renderFramePNG(project, 12) },
      {
        label: "Add the earlier position in blue",
        png: await renderOnionSkin(project, [current, previous]),
      },
      {
        label: "Add the later position in amber",
        png: await renderOnionSkin(project, [current, previous, next]),
      },
    ]),
  );
}
