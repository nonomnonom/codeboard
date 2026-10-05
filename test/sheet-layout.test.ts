import { Canvas } from "skia-canvas";
import { StoryboardProject } from "../src/index.js";
import { layoutStoryboard } from "../src/export/sheet-layout.js";

it("flows every caption field in order across continuation cells without dropping text", () => {
  const board = StoryboardProject.create({ title: "Caption layout" });
  const shot = board.addScene("S").addShot("S");
  const action = Array.from({ length: 90 }, (_, i) => `action${i}`).join(" ");
  const dialogue = `First line\n\nA long identifier: ${"abcdefghij".repeat(15)}`;
  const panel = shot.addPanel({
    title: "A complete caption",
    action,
    dialogue,
    camera: "Hold, then track left.",
    notes: "Final note: preserve this.",
  });
  shot.addPanel({ title: "Next panel" });
  const document = board.toJSON(),
    layout = layoutStoryboard(document, { columns: 2, rows: 2, captionHeight: 108 });
  const cells = layout.pages.flat(),
    first = cells.filter((c) => c.panelIndex === 0);
  expect(layout.pages.length).toBeGreaterThan(1);
  expect(first.map((c) => c.part)).toEqual(Array.from({ length: first.length }, (_, i) => i + 1));
  const normalize = (text: string) => text.replace(/\s/g, "");
  const actual = first.flatMap((c) => c.lines.map((l) => l.text)).join("");
  expect(normalize(actual)).toBe(
    normalize(
      `A complete captionAction: ${action}Dialogue: ${dialogue}Camera: Hold, then track left.Notes: Final note: preserve this.`,
    ),
  );
  expect(cells.at(-1)?.panelIndex).toBe(1);
  const ctx = new Canvas(1, 1).getContext("2d");
  for (const cell of cells)
    for (const line of cell.lines) {
      ctx.font = line.title ? "700 14px sans-serif" : "14px sans-serif";
      expect(ctx.measureText(line.text).width).toBeLessThanOrEqual(layout.cellWidth);
    }
  expect(document.panels[0]!.id).toBe(panel.id);
});

it("rejects unusable page geometry before exporting artwork", () => {
  const board = StoryboardProject.create({ title: "Layout" });
  for (const options of [
    { columns: 0 },
    { rows: 1.5 },
    { gutter: -1 },
    { pageWidth: NaN },
    { captionHeight: 20 },
    { pageHeight: 40 },
    { pageWidth: 100000, pageHeight: 100000 },
  ])
    expect(() => layoutStoryboard(board.toJSON(), options)).toThrow(/sheet|page/i);
});
