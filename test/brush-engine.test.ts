import {
  StoryboardProject,
  brushes,
  customizeBrush,
  line,
  renderPanelPNG,
  renderBrushSwatch,
} from "../src/index.js";
import { sampleDabs } from "../src/render/brush-engine.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("raster brush engine", () => {
  it("isolates cached bitmap color and pressure-hardness variants without altering the hard tip", async () => {
    const brush = customizeBrush(brushes.cleanInk, {
      size: 40,
      spacing: 0.04,
      hardness: 1,
      texture: "none",
      taperStart: 0,
      taperEnd: 0,
      tip: {
        kind: "bitmap",
        width: 16,
        height: 24,
        alpha: Array.from({ length: 384 }, (_, i) => (i % 16 < 5 ? 1 : 0.3)),
        angle: 0.3,
        rotationMode: "stroke",
      },
      dynamics: { pressureHardness: 0 },
    });
    const original = await renderBrushSwatch(brush, { color: "#12345699" });
    const varying = await renderBrushSwatch(
      customizeBrush(brush, { hardness: 0.9, dynamics: { pressureHardness: 0.9 } }),
      { color: "#12345699" },
    );
    expect(varying.equals(original)).toBe(false);
    const otherColor = await renderBrushSwatch(brush, { color: "#d68f3299" });
    expect(otherColor.equals(original)).toBe(false);
    expect((await renderBrushSwatch(brush, { color: "#12345699" })).equals(original)).toBe(true);
    expect(
      (
        await renderBrushSwatch(
          customizeBrush(brush, { hardness: 0.9, dynamics: { pressureHardness: 0.9 } }),
          { color: "#12345699" },
        )
      ).equals(varying),
    ).toBe(true);
  });
  it("revises library presets atomically while preserving saved stroke snapshots", async () => {
    const directory = await mkdtemp(join(tmpdir(), "brush-revision-"));
    try {
      const project = StoryboardProject.create({
        title: "Preset revisions",
        width: 100,
        height: 64,
      });
      const panel = project.addScene("S").addShot("A").addPanel(),
        paint = panel.addRasterLayer("Paint");
      const id = project.production.createBrush({ ...brushes.cleanInk, id: "brush:test", size: 9 });
      const points = line({ x: 10, y: 32, pressure: 0.4 }, { x: 90, y: 32, pressure: 1 }, 20);
      const oldStroke = paint.rasterStroke(points, project.production.brush(id));
      const original = await renderPanelPNG(project, panel.id);
      project.transaction("Correct preset", () => {
        const before = project.toJSON();
        for (const changes of [
          { size: NaN },
          { spacing: 0 },
          {
            tip: {
              kind: "bitmap",
              width: 2,
              height: 2,
              alpha: [1],
              angle: 0,
              rotationMode: "fixed",
            },
          },
        ]) {
          expect(() => project.production.reviseBrush(id, changes as never)).toThrow();
          expect(() =>
            project.production.createBrush({ ...brushes.cleanInk, ...changes } as never),
          ).toThrow();
          expect(project.toJSON()).toEqual(before);
        }
        expect(project.production.reviseBrush(id, { size: 27 })).toBe(2);
      });
      expect((await renderPanelPNG(project, panel.id)).equals(original)).toBe(true);
      project.undo();
      expect(project.production.brush(id).version).toBe(1);
      project.redo();
      expect(project.production.brush(id).version).toBe(2);
      const newer = paint.rasterStroke(points, project.production.brush(id));
      const changed = await renderPanelPNG(project, panel.id);
      expect(changed.equals(original)).toBe(false);
      const file = join(directory, "brush.cboard");
      await project.save(file);
      const reopened = await StoryboardProject.open(file);
      for (const [strokeId, version, size] of [
        [oldStroke, 1, 9],
        [newer, 2, 27],
      ] as const) {
        const stroke = reopened.production.element(strokeId);
        if (stroke.kind !== "raster-stroke") throw new Error("Expected painting stroke");
        expect(stroke.brush).toMatchObject({ id, version, size });
      }
      expect((await renderPanelPNG(reopened, panel.id)).equals(changed)).toBe(true);
      reopened
        .panel(panel.id)
        .layer(paint.id)
        .edit(newer, (e) => ({ ...e, visible: false }));
      expect((await renderPanelPNG(reopened, panel.id)).equals(original)).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("paints a stationary pen contact once using its final pressure", async () => {
    async function render(points: { x: number; y: number; pressure: number; time: number }[]) {
      const project = StoryboardProject.create({
        title: "Stationary contact",
        width: 64,
        height: 64,
        background: "#ffffff",
      });
      const panel = project.addScene("S").addShot("A").addPanel();
      panel.addRasterLayer("Paint").rasterStroke(points, brushes.cleanInk);
      return renderPanelPNG(project, panel.id, { annotations: false });
    }
    const first = { x: 32, y: 32, pressure: 0.2, time: 0 },
      last = { x: 32, y: 32, pressure: 1, time: 16 };
    expect((await render([first, last])).equals(await render([last]))).toBe(true);
  });
  it("disables procedural texture attenuation when texture is none, including bitmap tips", async () => {
    for (const tip of [
      brushes.cleanInk.tip,
      {
        kind: "bitmap" as const,
        width: 3,
        height: 2,
        alpha: [1, 0.2, 0, 0.3, 1, 0.6],
        angle: 0.2,
        rotationMode: "stroke" as const,
      },
    ]) {
      const base = customizeBrush(brushes.cleanInk, {
        tip,
        size: 28,
        flow: 0.3,
        spacing: 0.3,
        texture: "none",
        textureStrength: 0,
      });
      const plain = await renderBrushSwatch(base);
      expect(
        (await renderBrushSwatch(customizeBrush(base, { textureStrength: 1 }))).equals(plain),
      ).toBe(true);
      expect(
        (
          await renderBrushSwatch(customizeBrush(base, { texture: "graphite", textureStrength: 1 }))
        ).equals(plain),
      ).toBe(false);
    }
  });
  it("keeps painted snapshots and the source bitmap brush unchanged when a variant is edited", async () => {
    const project = StoryboardProject.create({
      title: "Brush variants",
      width: 80,
      height: 60,
      background: "#ffffff",
    });
    const panel = project.addScene("S").addShot("A").addPanel(),
      paint = panel.addRasterLayer("Paint");
    const base = customizeBrush(brushes.cleanInk, {
      size: 20,
      tip: {
        kind: "bitmap",
        width: 2,
        height: 2,
        alpha: [1, 0, 0.3, 1],
        angle: 0,
        rotationMode: "stroke",
      },
    });
    const variant = customizeBrush(base, { id: "brush:variant" });
    const points = line({ x: 10, y: 30, pressure: 0.3 }, { x: 70, y: 30, pressure: 1 }, 12);
    paint.rasterStroke(points, variant, { seed: 4 });
    const before = await renderPanelPNG(project, panel.id);
    if (variant.tip.kind !== "bitmap") throw new Error("Expected bitmap");
    variant.tip.alpha.fill(0);
    expect(await renderPanelPNG(project, panel.id)).toEqual(before);
    const comparison = StoryboardProject.create({
      title: "Source brush",
      width: 80,
      height: 60,
      background: "#ffffff",
    });
    const sourcePanel = comparison.addScene("S").addShot("A").addPanel();
    sourcePanel.addRasterLayer("Paint").rasterStroke(points, base, { seed: 4 });
    expect(await renderPanelPNG(comparison, sourcePanel.id)).toEqual(before);
  });
  it("uses spacing and pressure to produce stable dabs", () => {
    const stroke = {
      kind: "raster-stroke" as const,
      id: "stroke",
      points: line({ x: 0, y: 0, pressure: 0.1 }, { x: 100, y: 0, pressure: 1 }, 4),
      brush: customizeBrush(brushes.roughPencil, { size: 10, spacing: 0.5 }),
      color: "#000000",
      opacity: 1,
      erase: false,
      seed: 7,
      visible: true,
    };
    const dabs = sampleDabs(stroke);
    expect(dabs).toHaveLength(21);
    expect(dabs[0]?.pressure).toBeCloseTo(0.1);
    expect(dabs.at(-1)?.pressure).toBeCloseTo(1);
  });

  it("replays paint and eraser commands deterministically", async () => {
    const project = StoryboardProject.create({
      title: "Erase",
      width: 180,
      height: 100,
      background: "#ffffff",
    });
    const panel = project.addScene("S").addShot("A").addPanel({ id: "panel" });
    const paint = panel.addRasterLayer("Paint", { id: "paint" });
    paint.rasterStroke(
      line({ x: 15, y: 50, pressure: 1 }, { x: 165, y: 50, pressure: 1 }, 30),
      customizeBrush(brushes.cleanInk, { size: 30 }),
      { color: "#111111", seed: 1 },
    );
    const before = await renderPanelPNG(project, panel.id);
    paint.erase(
      line({ x: 90, y: 20, pressure: 1 }, { x: 90, y: 80, pressure: 1 }, 20),
      customizeBrush(brushes.softEraser, { size: 36, opacity: 1, flow: 1 }),
      { seed: 2 },
    );
    const after = await renderPanelPNG(project, panel.id);
    expect(after.equals(before)).toBe(false);
    expect((await renderPanelPNG(project, panel.id)).equals(after)).toBe(true);
  });
});
