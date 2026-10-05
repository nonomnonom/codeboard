import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  StoryboardProject,
  renderPanelPNG,
  createRenderSession,
  pathCommands,
  catmullRom,
} from "../../../src/index.js";

describe("production invariants", () => {
  it("rejects invalid mask assignments before changing any layer settings in a caught transaction", () => {
    const p = StoryboardProject.create({ title: "Mask assignment" }),
      panel = p.addScene("S").addShot("S").addPanel();
    const group = panel.addGroup("G"),
      child = panel.addVectorLayer("Child", {}, group.id),
      other = panel.addVectorLayer("Other");
    p.transaction("Correct invalid mask", () => {
      for (const id of ["missing", group.id, child.id]) {
        const before = p.toJSON();
        expect(() => child.set({ maskLayerId: id, opacity: 0.2, name: "Uncommitted" })).toThrow(
          /dependency/,
        );
        expect(p.toJSON()).toEqual(before);
      }
      child.set({ maskLayerId: other.id });
      const before = p.toJSON();
      expect(() => other.set({ maskLayerId: group.id })).toThrow(/Circular/);
      expect(p.toJSON()).toEqual(before);
      child.set({ maskLayerId: null });
    });
    expect(p.production.layer(child.id)).toMatchObject({ name: "Child", opacity: 1 });
  });
  it("clears a mask through the public layer API and restores its rendered result on undo", async () => {
    const p = StoryboardProject.create({
      title: "Detach mask",
      width: 64,
      height: 64,
      background: "#ffffff",
    });
    const panel = p.addScene("S").addShot("S").addPanel(),
      mask = panel.addVectorLayer("Mask");
    mask.path(pathCommands("M 0 0 L 32 0 L 32 64 L 0 64 Z"), { fill: "black" });
    const paint = panel.addVectorLayer("Paint", { maskLayerId: mask.id });
    paint.path(pathCommands("M 0 0 L 64 0 L 64 64 L 0 64 Z"), { fill: "#ff0000" });
    const before = await renderPanelPNG(p, panel.id, { annotations: false });
    paint.set({ maskLayerId: null });
    const after = await renderPanelPNG(p, panel.id, { annotations: false });
    const pixel = async (png: Buffer) =>
      Array.from(
        await sharp(png)
          .extract({ left: 48, top: 32, width: 1, height: 1 })
          .ensureAlpha()
          .raw()
          .toBuffer(),
      );
    expect(await pixel(before)).toEqual([255, 255, 255, 255]);
    expect(await pixel(after)).toEqual([255, 0, 0, 255]);
    p.undo();
    expect(await renderPanelPNG(p, panel.id, { annotations: false })).toEqual(before);
  });
  it("rejects removal of a mask subtree before mutating a caught transaction", () => {
    const p = StoryboardProject.create({ title: "Mask removal" }),
      panel = p.addScene("S").addShot("S").addPanel();
    const group = panel.addGroup("Masks"),
      mask = panel.addVectorLayer("Mask", {}, group.id);
    const paint = panel.addRasterLayer("Paint", { maskLayerId: mask.id });
    p.transaction("Handle dependency", () => {
      const before = p.toJSON();
      expect(() => p.production.removeLayer(group.id)).toThrow(/mask/i);
      expect(p.toJSON()).toEqual(before);
      p.setMetadata("handled", "yes");
      paint.set({ maskLayerId: null });
      p.production.removeLayer(group.id);
    });
    expect(p.production.layer(paint.id).maskLayerId).toBeUndefined();
    expect(p.production.find({ name: "Mask", panelId: panel.id })).toHaveLength(0);
    p.undo();
    expect(p.production.layer(paint.id).maskLayerId).toBe(mask.id);
  });
  it("removes contained review anchors with a group and restores them on undo", () => {
    const p = StoryboardProject.create({ title: "Reviewed group" }),
      panel = p.addScene("S").addShot("S").addPanel();
    const group = panel.addGroup("Drawing"),
      mask = panel.addVectorLayer("Mask", {}, group.id);
    const paint = panel.addVectorLayer("Ink", { maskLayerId: mask.id }, group.id);
    const element = paint.path(pathCommands("M 0 0 L 20 0 L 20 20 Z"), { fill: "black" });
    p.production.comment("Fix contour", { elementId: element });
    p.production.comment("Mask edge", { layerId: mask.id });
    const retained = p.production.comment("Panel note", { panelId: panel.id });
    const before = p.toJSON();
    p.production.removeLayer(group.id);
    expect(p.toJSON().panels[0]!.layers).toHaveLength(0);
    expect(p.toJSON().comments.map((c) => c.id)).toEqual([retained]);
    p.undo();
    expect(p.toJSON().panels).toEqual(before.panels);
    expect(p.toJSON().comments).toEqual(before.comments);
    p.redo();
    expect(p.toJSON().comments.map((c) => c.id)).toEqual([retained]);
  });
  it("requires unlocking a descendant before deleting its group", () => {
    const p = StoryboardProject.create({ title: "Locked child" }),
      panel = p.addScene("S").addShot("S").addPanel();
    const group = panel.addGroup("Drawing"),
      child = panel.addVectorLayer("Ink", {}, group.id);
    p.production.lock("layer", child.id, "Review");
    p.transaction("Handle lock", () => {
      const before = p.toJSON();
      expect(() => p.production.removeLayer(group.id)).toThrow(/unlock/i);
      expect(p.toJSON()).toEqual(before);
    });
  });
  it("interpolates through Catmull-Rom anchors without the previous half-segment discontinuity", () => {
    const p = catmullRom(
      [
        { x: 0, y: 0 },
        { x: 100, y: 40 },
        { x: 200, y: 0 },
      ],
      100,
    );
    expect(p[99]!.x).toBeGreaterThan(98);
    expect(p[100]!.x).toBe(100);
    expect(p.at(-1)).toMatchObject({ x: 200, y: 0 });
  });
  it("keeps negative local coordinates inside translated groups in cached and direct render", async () => {
    const p = StoryboardProject.create({ title: "Group", width: 128, height: 128 });
    const panel = p.addScene("S").addShot("S").addPanel();
    const group = panel.addGroup("G", { transform: { x: 64, y: 64 } });
    panel
      .addVectorLayer("Wing", {}, group.id)
      .path(pathCommands("M -40 -40 L 40 -40 L 0 40 Z"), { fill: "black" });
    const direct = await renderPanelPNG(p, panel.id, { annotations: false });
    const cached = await createRenderSession(p).panel(panel.id).toBuffer("png");
    expect(cached.equals(direct)).toBe(true);
  });
  it("preserves instances when a component source is revised; refresh is explicit", () => {
    const p = StoryboardProject.create({ title: "Components" });
    const shot = p.addScene("S").addShot("S");
    const a = shot.addPanel(),
      b = shot.addPanel();
    const layer = a.addVectorLayer("Prop");
    const element = layer.path(pathCommands("M 0 0 L 10 0 L 10 10 Z"), { fill: "black" });
    const component = p.production.captureComponent(layer.id, "Prop");
    const instance = p.production.instantiateComponent(component, b.id);
    const before = p.production.layer(instance);
    layer.edit(element, (e) => ({ ...e, opacity: 0.5 }));
    p.production.reviseComponent(component, layer.id);
    expect(p.production.layer(instance)).toEqual(before);
    p.production.refreshComponentInstance(instance);
    expect(p.production.layer(instance).componentSource?.version).toBe(2);
    expect(p.production.layer(instance)).not.toEqual(before);
    expect(() => StoryboardProject.fromJSON(p.toJSON())).not.toThrow();
  });
  it("remaps mask IDs when copying a panel", () => {
    const p = StoryboardProject.create({ title: "Mask" });
    const a = p.addScene("S").addShot("S").addPanel();
    const mask = a.addVectorLayer("Mask");
    a.addRasterLayer("Paint", { maskLayerId: mask.id });
    const copy = p.production.duplicatePanel(a.id),
      layers = p.toJSON().panels.find((x) => x.id === copy)!.layers;
    expect(layers[1]!.maskLayerId).toBe(layers[0]!.id);
    expect(layers[0]!.id).not.toBe(mask.id);
  });
  it("rolls back duplicate IDs and group-mask cycles at mutation time", () => {
    const p = StoryboardProject.create({ title: "Validation" });
    const a = p.addScene("S").addShot("S").addPanel();
    const g = a.addGroup("G");
    const mask = a.addVectorLayer("Mask", {}, g.id);
    const before = p.toJSON();
    expect(() => mask.set({ maskLayerId: g.id })).toThrow(/Circular/);
    expect(p.toJSON()).toEqual(before);
    expect(() => a.addVectorLayer("Dup", { id: mask.id })).toThrow(/Duplicate/);
  });
  it("honors a panel lock for indirect layer and timeline changes", () => {
    const p = StoryboardProject.create({ title: "Locks" });
    const shot = p.addScene("S").addShot("S"),
      a = shot.addPanel(),
      b = shot.addPanel();
    const l = b.addVectorLayer("Ink");
    p.production.lock("panel", b.id, "review");
    const other = StoryboardProject.fromJSON(p.toJSON(), { actor: "other" });
    expect(() => other.production.addLayerKeyframe(l.id, 48, { opacity: 0.2 })).toThrow(/Locked/);
    expect(() => other.production.setPanelDuration(a.id, 60)).toThrow(/Locked/);
  });
});
