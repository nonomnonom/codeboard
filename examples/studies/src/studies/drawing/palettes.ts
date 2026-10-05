import assert from "node:assert/strict";
import { StoryboardProject, renderFramePNG, planPaletteMerge } from "codeboard-studio";
import { join } from "node:path";
import { amber, blue, ink, make, rect, save, text } from "../../shared.ts";
import { sheet, report } from "../../shared/artifacts.ts";

export async function render(output: string): Promise<void> {
  const project = make("Shared palette and local override");
  const panel = project
    .addScene("Study")
    .addShot("Palette propagation")
    .addPanel({ durationFrames: 1 });
  const art = panel.addVectorLayer("Coats");
  const trimIds: string[] = [];
  const ids = [60, 160, 260].map((x) => {
    trimIds.push(rect(art, x - 8, 70, 16, 20, ink));
    return rect(art, x - 28, 100, 56, 95, amber);
  });
  for (const [index, label] of ["Shared", "Shared", "Override"].entries())
    text(art, label, 25 + index * 100, 235, 16);
  const definition = {
    id: "palette:coats",
    name: "Coats",
    swatches: [
      { id: "swatch:cloth", name: "Cloth", color: amber },
      { id: "swatch:trim", name: "Trim", color: ink },
    ],
  };
  project.putPalette(definition);
  for (const id of ids) project.setColorBinding(id, "fill", { swatchId: "swatch:cloth" });
  for (const id of trimIds) project.setColorBinding(id, "fill", { swatchId: "swatch:trim" });
  project.setColorBinding(ids[2]!, "fill", { swatchId: "swatch:cloth", override: ink });
  const before = await renderFramePNG(project, 0);
  project.capturePanelAnimation(panel.id, { id: "animation:palette" });
  project.putPalette({
    ...definition,
    swatches: [{ ...definition.swatches[0]!, color: blue }, definition.swatches[1]!],
  });
  assert.equal(project.production.element(ids[2]!).colorBindings?.fill?.override, ink);
  const after = await renderFramePNG(project, 0);
  assert.notDeepEqual(before, after);
  await save(
    output,
    "palettes",
    project,
    await sheet(
      "Shared palette",
      [
        { label: "1. Amber swatch", png: before },
        { label: "2. Blue swatch; override retained", png: after },
      ],
      2,
    ),
  );
  const incoming = {
    ...definition,
    swatches: [definition.swatches[0]!, { ...definition.swatches[1]!, color: "#ffe1a0" }],
  };
  const merge = planPaletteMerge(project, definition, incoming);
  if (!merge.plan) throw new Error("Palette study requires independent local/incoming changes");
  const receipt = await project.commit(merge.plan, { requestId: "study:palette-merge" });
  const reopened = await StoryboardProject.open(join(output, "palettes.cboard"));
  await save(
    output,
    "palettes",
    reopened,
    await sheet(
      "Shared palette merge",
      [
        { label: "Baseline", png: before },
        { label: "Local cloth correction", png: after },
        { label: "Incoming trim + local cloth", png: await renderFramePNG(reopened, 0) },
      ],
      3,
    ),
  );
  await report(output, "palette-merge", { merge, receipt });
  await report(output, "bindings", {
    palette: reopened.paletteSwatches(definition.id),
    consumers: reopened.paletteBindings("swatch:cloth"),
    elements: ids.map((id) => ({ id, binding: reopened.production.element(id).colorBindings })),
  });
}
