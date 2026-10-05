import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StoryboardProject, ProjectStore, renderShotFramePNG, type Palette } from "../src/index.js";
import { allLayers } from "../src/model/layers.js";

const palette = (color: string): Palette => ({
  id: "palette:character",
  name: "Character",
  swatches: [{ id: "swatch:shirt", name: "Shirt", color }],
});

function fixture() {
  const project = StoryboardProject.create({ title: "Shared palette", width: 32, height: 32 });
  project.putPalette(palette("red"));
  const scene = project.addScene("Scene");
  const panels = [scene.addShot("A").addPanel(), scene.addShot("B").addPanel()];
  const elements = panels.map((panel, index) => {
    const layer = panel.addVectorLayer("Shirt");
    const id = layer.path(
      [
        { op: "M", x: 4, y: 4 },
        { op: "L", x: 28, y: 4 },
        { op: "L", x: 28, y: 28 },
        { op: "L", x: 4, y: 28 },
        { op: "Z" },
      ],
      { fill: "black" },
    );
    project.setColorBinding(id, "fill", { swatchId: "swatch:shirt" });
    const capture = project.capturePanelAnimation(panel.id, { id: `animation:${index}` });
    return {
      id,
      layerId: layer.id,
      shotId: capture.identities.find((entry) => entry.sourceId === id)!.capturedId,
    };
  });
  project.production.captureComponent(elements[0]!.layerId, "Shirt", { id: "component:shirt" });
  return { project, panels, elements };
}

it("propagates shared colors across board, captured shots and components while retaining local overrides", async () => {
  const { project, elements } = fixture();
  const firstBefore = await renderShotFramePNG(project.shotAnimation("animation:0"), 0);
  project.setColorBinding(elements[1]!.shotId, "fill", {
    swatchId: "swatch:shirt",
    override: "blue",
  });
  const overridden = await renderShotFramePNG(project.shotAnimation("animation:1"), 0);
  expect(project.production.element(elements[1]!.shotId).colorBindings?.fill?.override).toBe(
    "blue",
  );
  project.putPalette(palette("green"));
  const firstAfter = await renderShotFramePNG(project.shotAnimation("animation:0"), 0);
  expect(firstAfter).not.toEqual(firstBefore);
  expect(await renderShotFramePNG(project.shotAnimation("animation:1"), 0)).toEqual(overridden);
  const document = project.toJSON();
  for (const owner of [...document.panels, ...document.components])
    for (const layer of allLayers(owner.layers))
      if (layer.kind !== "group")
        for (const element of layer.elements)
          expect(element).toMatchObject({
            fill: "green",
            colorBindings: { fill: { swatchId: "swatch:shirt" } },
          });
  expect(project.undo()).toBe(true);
  expect(project.paletteSwatches("palette:character")[0]!.color).toBe("red");
  expect(await renderShotFramePNG(project.shotAnimation("animation:0"), 0)).toEqual(firstBefore);
  expect(project.redo()).toBe(true);
  expect(await renderShotFramePNG(project.shotAnimation("animation:0"), 0)).toEqual(firstAfter);
  project.setColorBinding(elements[1]!.shotId, "fill", { swatchId: "swatch:shirt" });
  expect(await renderShotFramePNG(project.shotAnimation("animation:1"), 0)).toEqual(firstAfter);
  project.setColorBinding(elements[1]!.shotId, "fill", null);
  project.putPalette(palette("yellow"));
  expect(await renderShotFramePNG(project.shotAnimation("animation:1"), 0)).toEqual(firstAfter);
});

it("persists palette edit plans, durable retries, bounded discovery and targeted panel revisions", async () => {
  const { project, panels, elements } = fixture();
  const directory = await mkdtemp(join(tmpdir(), "codeboard-palettes-"));
  try {
    const file = join(directory, "palette.cboard");
    await project.save(file);
    const plan = project.plan("Revise shared shirt", [
      { op: "palette.put", palette: palette("green") },
      {
        op: "palette.bind",
        elementId: elements[1]!.shotId,
        channel: "fill",
        binding: { swatchId: "swatch:shirt", override: "blue" },
      },
    ]);
    const receipt = await project.commit(JSON.parse(JSON.stringify(plan)), {
      requestId: "palette-pass",
    });
    const opened = await StoryboardProject.open(file);
    expect(await opened.commit(plan, { requestId: "palette-pass" })).toEqual({
      ...receipt,
      replayed: true,
    });
    expect(opened.palettes()).toEqual([
      { id: "palette:character", name: "Character", swatchCount: 1 },
    ]);
    const detached = opened.paletteSwatches("palette:character");
    detached[0]!.color = "black";
    expect(opened.paletteSwatches("palette:character")[0]!.color).toBe("green");
    expect(
      opened.production.query({ kind: "palette-swatch" }).items.map((item) => item.id),
    ).toEqual(["swatch:shirt"]);
    using store = ProjectStore.open(file);
    expect(store.query({ kind: "palette" }).items.map((item) => item.id)).toEqual([
      "palette:character",
    ]);
    store.saveRevision("green", { expectedVersion: opened.version });
    const panel = store.readPanel(panels[0]!.id);
    panel.notes = "A targeted edit keeps the binding";
    store.updatePanel(panel, { expectedVersion: store.version });
    const broken = store.readPanel(panel.id);
    const drawing = broken.layers[0]!;
    if (drawing.kind !== "vector") throw new Error("Expected vector layer");
    const shape = drawing.elements[0]!;
    if (shape.kind !== "vector-path") throw new Error("Expected path");
    shape.fill = "black";
    const version = store.version;
    expect(() => store.updatePanel(broken, { expectedVersion: version })).toThrow(
      /Bound color differs/,
    );
    expect(store.version).toBe(version);
    store.compact();
    store.verify();
    expect(store.readRevision("green").studio.palettes).toEqual([palette("green")]);
    expect(store.readDocument().panels[0]!.notes).toBe(panel.notes);
    expect(await renderShotFramePNG(opened.shotAnimation("animation:0"), 0)).toEqual(
      await renderShotFramePNG(project.shotAnimation("animation:0"), 0),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("rejects dangling swatches, invalid channels, identity collisions and locked propagation atomically", () => {
  const { project, elements } = fixture();
  const before = project.toJSON();
  expect(() => project.removePalette("palette:character")).toThrow(
    expect.objectContaining({
      code: "INVALID_ARGUMENT",
      details: expect.objectContaining({
        paletteId: "palette:character",
        swatchId: "swatch:shirt",
      }),
    }),
  );
  expect(() => project.putPalette({ ...palette("red"), swatches: [] })).toThrow(
    /Missing palette swatch/,
  );
  expect(() =>
    project.setColorBinding(elements[0]!.id, "color", { swatchId: "swatch:shirt" }),
  ).toThrow(/not supported/);
  expect(() =>
    project.setColorBinding(elements[0]!.id, "fill", { swatchId: "missing", override: "blue" }),
  ).toThrow(/Missing palette swatch/);
  expect(() =>
    project.putPalette({ ...palette("red"), id: elements[0]!.id, swatches: [] }),
  ).toThrow(/Duplicate stable id/);
  expect(() => project.putPalette(palette("not-a-color"))).toThrow();
  expect(project.toJSON()).toEqual(before);
  project.production.lock(
    "layer",
    project.shotAnimation("animation:0").layers[0]!.id,
    "Color approval",
  );
  const other = StoryboardProject.fromJSON(project.toJSON(), { actor: "agent:other" });
  const locked = other.toJSON();
  expect(() => other.putPalette(palette("blue"))).toThrow(/Locked by/);
  expect(other.toJSON()).toEqual(locked);
  const malformed = structuredClone(before);
  malformed.studio.palettes![0]!.swatches[0]!.color = "blue";
  expect(() => StoryboardProject.fromJSON(malformed)).toThrow(/Bound color differs/);
});

it("preserves the color binding when outlining a vector stroke and permits explicit unbind then palette removal", () => {
  const project = StoryboardProject.create({ title: "Outline" });
  const layer = project.addScene("Scene").addShot("Shot").addPanel().addVectorLayer("Line");
  const id = layer.vectorStroke(
    [
      { x: 4, y: 4 },
      { x: 20, y: 20 },
    ],
    { color: "red" },
  );
  project.putPalette(palette("red"));
  project.setColorBinding(id, "color", { swatchId: "swatch:shirt" });
  layer.outlineStroke(id);
  project.putPalette(palette("blue"));
  expect(project.production.element(id)).toMatchObject({
    kind: "vector-path",
    fill: "blue",
    colorBindings: { fill: { swatchId: "swatch:shirt" } },
  });
  project.transaction("Detach palette", () => {
    project.setColorBinding(id, "fill", null);
    project.removePalette("palette:character");
  });
  expect(project.production.element(id)).toMatchObject({ fill: "blue" });
  expect(project.production.element(id).colorBindings).toBeUndefined();
  expect(project.palettes()).toEqual([]);
});
