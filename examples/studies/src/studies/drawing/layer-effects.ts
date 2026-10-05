import { renderFramePNG, type LayerEffect } from "codeboard-studio";
import { make, rect, amber, blue, save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Change the finish, keep the drawing");
  const shot = project.addScene("Effects").addShot("Same layered card");
  const looks: [string, LayerEffect[]][] = [
    ["Original colors and sharp edges", []],
    ["Remove color with saturation zero", [{ kind: "saturation", amount: 0 }]],
    ["Rotate the hues", [{ kind: "hue-rotate", degrees: 120 }]],
    ["Darken with brightness", [{ kind: "brightness", amount: 0.5 }]],
    ["Blur the completed artwork", [{ kind: "blur", amount: 6 }]],
    [
      "Cast a soft offset shadow",
      [
        {
          kind: "shadow",
          amount: 5,
          offsetX: 18,
          offsetY: 14,
          opacity: 0.6,
          color: { r: 30, g: 30, b: 30 },
        },
      ],
    ],
  ];
  const samples = [];
  for (const [label, effects] of looks) {
    const panel = shot.addPanel({ durationFrames: 1 });
    const group = panel.addGroup("Card", { effects });
    const art = panel.addVectorLayer("Card artwork", {}, group.id);
    rect(art, 75, 60, 210, 150, amber);
    rect(art, 95, 82, 75, 70, blue);
    rect(art, 190, 90, 72, 10, "#ffe1a0");
    rect(art, 95, 174, 165, 12, "#ffe1a0");
    samples.push({ label, png: await renderFramePNG(project, samples.length) });
  }
  await save(
    output,
    "layer-effects",
    project,
    await comparison(output, "Change the finish, keep the drawing", samples),
  );
}
