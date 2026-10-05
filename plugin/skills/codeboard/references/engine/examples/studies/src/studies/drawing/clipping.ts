import { pathCommands, renderContactSheet, type LayerEffect } from "codeboard-studio";
import { amber, make, rect, save } from "../../shared.ts";
export async function render(output: string): Promise<void> {
  const project = make("Clipping comparison");
  const shot = project.addScene("Study").addShot("Sibling alpha");
  for (const [title, clipped] of [
    ["Silhouette only", null],
    ["Unclipped highlight", false],
    ["Clipped highlight", true],
  ] as const) {
    const panel = shot.addPanel({ title, durationFrames: 1 });
    const base = panel.addVectorLayer("Silhouette");
    base.path(pathCommands("M 70 230 L 95 75 Q 180 15 265 75 L 290 230 Z"), { fill: amber });
    if (clipped !== null) {
      const highlight = panel.addVectorLayer("Highlight", { clipToBelow: clipped });
      rect(highlight, 30, 100, 300, 42, "#f7ce7f");
      rect(highlight, 30, 166, 300, 24, "#f7ce7f");
    }
  }
  const looks: { title: string; effects: LayerEffect[] }[] = [
    { title: "Desaturated group", effects: [{ kind: "saturation", amount: 0 }] },
    { title: "Cool hue", effects: [{ kind: "hue-rotate", degrees: 160 }] },
    { title: "Hue -30", effects: [{ kind: "hue-rotate", degrees: -30 }] },
    { title: "Hue 330 reference", effects: [{ kind: "hue-rotate", degrees: 330 }] },
    {
      title: "Two brightness slots",
      effects: [
        { kind: "brightness", amount: 0.5 },
        { kind: "brightness", amount: 0.5 },
      ],
    },
    { title: "Brightness 0.25 reference", effects: [{ kind: "brightness", amount: 0.25 }] },
    { title: "Blur 0", effects: [{ kind: "blur", amount: 0 }] },
    { title: "Blur 4", effects: [{ kind: "blur", amount: 4 }] },
    { title: "Blur 12", effects: [{ kind: "blur", amount: 12 }] },
    {
      title: "Hard shadow",
      effects: [
        {
          kind: "shadow",
          amount: 0,
          offsetX: 18,
          offsetY: 12,
          color: { r: 20, g: 24, b: 32 },
          opacity: 0.7,
        },
      ],
    },
    {
      title: "Soft shadow",
      effects: [
        {
          kind: "shadow",
          amount: 6,
          offsetX: 18,
          offsetY: 12,
          color: { r: 20, g: 24, b: 32 },
          opacity: 0.7,
        },
      ],
    },
    {
      title: "Opposite shadows",
      effects: [
        {
          kind: "shadow",
          amount: 3,
          offsetX: -16,
          offsetY: -8,
          color: { r: 26, g: 85, b: 164 },
          opacity: 0.6,
        },
        {
          kind: "shadow",
          amount: 3,
          offsetX: 16,
          offsetY: 8,
          color: { r: 154, g: 24, b: 42 },
          opacity: 0.6,
        },
      ],
    },
    {
      title: "Contrast then brightness",
      effects: [
        { kind: "contrast", amount: 1.5 },
        { kind: "brightness", amount: 0.7 },
      ],
    },
  ];
  for (const look of looks) {
    const panel = shot.addPanel({ title: look.title, durationFrames: 1 });
    const group = panel.addGroup("Graded artwork", { effects: look.effects });
    const base = panel.addVectorLayer("Silhouette", {}, group.id);
    base.path(pathCommands("M 70 230 L 95 75 Q 180 15 265 75 L 290 230 Z"), { fill: amber });
    const highlight = panel.addVectorLayer("Highlight", { clipToBelow: true }, group.id);
    if (look.effects.some((effect) => effect.kind === "blur" || effect.kind === "shadow"))
      rect(base, -18, 85, 14, 120, "#e05030");
    rect(highlight, 30, 100, 300, 42, "#f7ce7f");
    rect(highlight, 30, 166, 300, 24, "#f7ce7f");
  }
  await save(
    output,
    "clipping",
    project,
    await renderContactSheet(project, { columns: 3, thumbnailWidth: 360 }),
  );
}
