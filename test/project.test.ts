import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StoryboardProject, brushes, line, renderPanelPNG } from "../src/index.js";

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function fixture() {
  const project = StoryboardProject.create({
    title: "Isolation test",
    width: 240,
    height: 135,
    seed: 9,
  });
  const shot = project.addScene("Scene").addShot("Shot");
  const a = shot.addPanel({ id: "panel:a", title: "A" });
  const b = shot.addPanel({ id: "panel:b", title: "B" });
  const inkA = a.addVectorLayer("Ink A", { id: "layer:a" });
  const inkB = b.addVectorLayer("Ink B", { id: "layer:b" });
  const strokeA = inkA.vectorStroke(line({ x: 10, y: 20 }, { x: 200, y: 100 }), {
    id: "stroke:a",
    width: 8,
  });
  inkB.vectorStroke(line({ x: 20, y: 110 }, { x: 220, y: 25 }), { id: "stroke:b", width: 6 });
  return { project, a, b, inkA, strokeA };
}

function creativeState(project: StoryboardProject) {
  const document = project.toJSON();
  return {
    scenes: document.scenes,
    shots: document.shots,
    panels: document.panels,
    brushes: document.brushes,
    assets: document.assets,
    audioTracks: document.audioTracks,
    comments: document.comments,
    locks: document.locks,
    metadata: document.metadata,
  };
}

describe("document invariants", () => {
  it("requires unlocking panel descendants before deletion, even inside a caught transaction", () => {
    const { project, a, inkA } = fixture(),
      lock = project.production.lock("layer", inkA.id, "Review");
    project.transaction("Resolve deletion lock", () => {
      const before = project.toJSON();
      expect(() => project.production.deletePanel(a.id)).toThrow(/unlock/);
      expect(project.toJSON()).toEqual(before);
      project.production.unlock(lock);
      project.production.deletePanel(a.id);
    });
    expect(project.toJSON().panels.map((p) => p.id)).toEqual(["panel:b"]);
    project.undo();
    expect(project.toJSON().locks[0]!.id).toBe(lock);
    expect(project.toJSON().panels.map((p) => p.id)).toEqual(["panel:a", "panel:b"]);
  });
  it.each(["selection", "panel"] as const)(
    "removes dependent comments with a %s and restores them on undo",
    (operation) => {
      const { project, a, b, inkA, strokeA } = fixture();
      project.production.comment("Contour", { elementId: strokeA });
      project.production.comment("Combined anchor", {
        panelId: a.id,
        layerId: inkA.id,
        elementId: strokeA,
      });
      const layerNote = project.production.comment("Layer", { layerId: inkA.id });
      const panelNote = project.production.comment("Panel", { panelId: a.id });
      const other = project.production.comment("Keep", { panelId: b.id });
      const before = creativeState(project);
      if (operation === "selection")
        project.select({ panelId: a.id, layerId: inkA.id, elementIds: [strokeA] }).remove();
      else project.production.deletePanel(a.id);
      const expected = operation === "selection" ? [layerNote, panelNote, other] : [other];
      expect(project.toJSON().comments.map((c) => c.id)).toEqual(expected);
      project.undo();
      expect(creativeState(project)).toEqual(before);
      project.redo();
      expect(project.toJSON().comments.map((c) => c.id)).toEqual(expected);
    },
  );
  it("treats a multi-element selection as one revision and rolls back missing targets", () => {
    const { project, a, inkA, strokeA } = fixture();
    const other = inkA.vectorStroke([{ x: 40, y: 50 }], { id: "stroke:second" });
    const selection = project.select({
      panelId: a.id,
      layerId: inkA.id,
      elementIds: [strokeA, other, strokeA],
    });
    const before = creativeState(project),
      version = project.version;
    selection.transform({ x: 10 });
    expect(project.version).toBe(version + 1);
    const transformed = project.production.layer(inkA.id);
    if (transformed.kind === "group") throw new Error("Expected drawing");
    const movedStroke = transformed.elements[0]!;
    if (movedStroke.kind !== "vector-stroke") throw new Error("Expected stroke");
    expect(movedStroke.points[0]?.x).toBe(10);
    expect(movedStroke.matrix).toEqual([1, 0, 0, 1, 10, 0]);
    project.undo();
    expect(creativeState(project)).toEqual(before);
    project.redo();
    const after = creativeState(project);
    selection.opacity(0.4);
    project.undo();
    expect(creativeState(project)).toEqual(after);
    const stable = project.toJSON();
    for (const operation of ["transform", "opacity", "remove"] as const) {
      const invalid = project.select({
        panelId: a.id,
        layerId: inkA.id,
        elementIds: [strokeA, "missing"],
      });
      expect(() =>
        operation === "transform"
          ? invalid.transform({ x: 9 })
          : operation === "opacity"
            ? invalid.opacity(0.1)
            : invalid.remove(),
      ).toThrow(/not found/i);
      expect(project.toJSON()).toEqual(stable);
    }
    project.transaction("Handle a rejected selection", () => {
      const snapshot = creativeState(project);
      expect(() =>
        project
          .select({ panelId: a.id, layerId: inkA.id, elementIds: [strokeA, "missing"] })
          .transform({ x: 3 }),
      ).toThrow(/not found/i);
      expect(creativeState(project)).toEqual(snapshot);
      project.setMetadata("rejectionHandled", "yes");
    });
    const ids = [strokeA, other],
      captured = project.select({ panelId: a.id, layerId: inkA.id, elementIds: ids });
    ids.push("missing");
    const beforeRemoval = creativeState(project);
    captured.remove();
    project.undo();
    expect(creativeState(project)).toEqual(beforeRemoval);
  });

  it("edits one stable element without changing another panel", async () => {
    const { project, a, b, inkA, strokeA } = fixture();
    const panelBBefore = await renderPanelPNG(project, b.id);
    project.select({ panelId: a.id, layerId: inkA.id, elementIds: [strokeA] }).transform({ x: 25 });
    const panelBAfter = await renderPanelPNG(project, b.id);
    expect(panelBAfter.equals(panelBBefore)).toBe(true);
    expect(project.toJSON().panels.find((panel) => panel.id === a.id)?.layers[0]?.kind).toBe(
      "vector",
    );
  });

  it("undoes and redoes a transaction atomically", () => {
    const { project, a, inkA, strokeA } = fixture();
    const before = project.toJSON();
    project.transaction("move and fade", () => {
      project
        .select({ panelId: a.id, layerId: inkA.id, elementIds: [strokeA] })
        .transform({ x: 12, y: -4 });
      project.select({ panelId: a.id, layerId: inkA.id, elementIds: [strokeA] }).opacity(0.5);
    });
    const changed = project.toJSON();
    expect(changed).not.toEqual(before);
    expect(project.undo()).toBe(true);
    expect(creativeState(project)).toEqual(creativeState(StoryboardProject.fromJSON(before)));
    const undoVersion = project.version;
    expect(project.redo()).toBe(true);
    expect(creativeState(project)).toEqual(creativeState(StoryboardProject.fromJSON(changed)));
    expect(project.version).toBeGreaterThan(undoVersion);
  });

  it("rejects a drawing operation on the wrong layer type", () => {
    const { inkA } = fixture();
    expect(() =>
      inkA.rasterStroke(line({ x: 0, y: 0 }, { x: 10, y: 10 }), brushes.roughPencil),
    ).toThrow(/raster layer/i);
  });

  it("round-trips a validated project and renders deterministically", async () => {
    const { project, a } = fixture();
    const directory = await mkdtemp(join(tmpdir(), "codeboard-"));
    temporary.push(directory);
    const path = join(directory, "project.cboard");
    await project.save(path);
    const reopened = await StoryboardProject.open(path);
    expect(reopened.toJSON()).toEqual(project.toJSON());
    const first = await renderPanelPNG(reopened, a.id);
    const second = await renderPanelPNG(reopened, a.id);
    expect(second.equals(first)).toBe(true);
  });

  it("rejects duplicate ids at the load boundary", () => {
    const { project } = fixture();
    const document = project.toJSON();
    document.panels[1]!.id = document.panels[0]!.id;
    expect(() => StoryboardProject.fromJSON(document)).toThrow(/duplicate stable id/i);
  });
});
