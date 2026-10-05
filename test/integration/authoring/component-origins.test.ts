import { expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StoryboardProject, createPixels, renderPanelPNG } from "../../../src/index.js";

function fixture() {
  const project = StoryboardProject.create({ title: "Tracked component", width: 40, height: 40 });
  const panel = project.addScene("S").addShot("S").addPanel({ durationFrames: 24 });
  const source = panel.addGroup("Prop");
  const paint = panel.addRasterLayer("Paint", {}, source.id);
  const pixels = createPixels(4, 4);
  for (let i = 0; i < pixels.pixels.length; i += 4) pixels.pixels.set([200, 40, 80, 255], i);
  paint.rasterSurface(pixels);
  const componentId = project.production.captureComponent(source.id, "Prop");
  const instanceId = project.production.instantiateComponent(componentId, panel.id, {
    x: 12,
    y: 8,
  });
  return { project, panel, source, componentId, instanceId };
}

it("retains an immutable raster baseline across library revision, save/reopen and paged inspection", async () => {
  const { project, panel, source, componentId, instanceId } = fixture();
  const baseline = project.toJSON().studio.componentOrigins![0]!;
  const first = project.componentOriginData(instanceId, { limit: 1 });
  expect(first).toMatchObject({
    baselineVersion: 1,
    libraryVersion: 1,
    instanceState: "matching",
    total: 3,
    nextOffset: 1,
  });
  expect(first.items[0]).toMatchObject({ location: "instance" });
  expect(JSON.stringify(first)).not.toMatch(/pixels|elements|children/);
  first.items[0]!.copyId = "modified-query";
  expect(project.componentOriginData(instanceId).items[0]!.copyId).not.toBe("modified-query");
  project.production.reviseComponent(componentId, source.id);
  expect(project.componentOriginData(instanceId)).toMatchObject({
    baselineVersion: 1,
    libraryVersion: 2,
    sha256: baseline.sha256,
  });
  expect(project.toJSON().studio.componentOrigins![0]).toEqual(baseline);
  const directory = await mkdtemp(join(tmpdir(), "codeboard-origins-"));
  try {
    const file = join(directory, "origin.cboard");
    const png = await renderPanelPNG(project, panel.id);
    await project.save(file);
    const reopened = await StoryboardProject.open(file);
    expect(reopened.toJSON().studio.componentOrigins![0]).toEqual(baseline);
    expect(await renderPanelPNG(reopened, panel.id)).toEqual(png);
    reopened.production.refreshComponentInstance(instanceId);
    const refreshed = reopened.componentOriginData(instanceId);
    expect(refreshed.baselineVersion).toBe(2);
    expect(refreshed.sha256).not.toBe(baseline.sha256);
    reopened.undo();
    expect(reopened.toJSON().studio.componentOrigins![0]).toEqual(baseline);
    reopened.redo();
    expect(reopened.componentOriginData(instanceId).sha256).toBe(refreshed.sha256);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("rolls back origin registration with its instance and restores it through undo/redo", () => {
  const { project, panel, componentId } = fixture();
  const before = project.toJSON();
  expect(() =>
    project.transaction("Interrupted instance", () => {
      project.production.instantiateComponent(componentId, panel.id);
      throw new Error("interrupted");
    }),
  ).toThrow("interrupted");
  expect(project.toJSON()).toEqual(before);
  const instance = project.production.instantiateComponent(componentId, panel.id);
  const origin = project.componentOriginData(instance);
  project.undo();
  expect(project.toJSON().studio.componentOrigins).toEqual(before.studio.componentOrigins);
  expect(() => project.componentOriginData(instance)).toThrow(
    expect.objectContaining({
      details: expect.objectContaining({ reason: "COMPONENT_ORIGIN_MISSING" }),
    }),
  );
  project.redo();
  expect(project.componentOriginData(instance).sha256).toBe(origin.sha256);
});

it("carries local deletions into duplicated panels and shot capture without pointing at another instance", () => {
  const { project, panel, instanceId } = fixture();
  const document = project.toJSON();
  const instance = document.panels[0]!.layers.find((layer) => layer.id === instanceId)!;
  if (instance.kind !== "group") throw new Error("Missing instance");
  instance.children = [];
  const revised = StoryboardProject.fromJSON(document);
  expect(
    revised.componentOriginData(instanceId).items.every((entry) => entry.location === "missing"),
  ).toBe(true);
  const copyPanel = revised.production.duplicatePanel(panel.id);
  const copy = revised
    .toJSON()
    .panels.find((entry) => entry.id === copyPanel)!
    .layers.find((layer) => layer.componentSource)!;
  const capture = revised.capturePanelAnimation(panel.id, { id: "animation:origin" });
  const capturedId = capture.identities.find((entry) => entry.sourceId === instanceId)!.capturedId;
  const reserved = new Set<string>();
  for (const id of [instanceId, copy.id, capturedId]) {
    const origin = revised.componentOriginData(id);
    expect(origin.instanceState).toBe("matching");
    expect(origin.items).toHaveLength(3);
    for (const entry of origin.items) {
      expect(entry.location).toBe("missing");
      expect(reserved.has(entry.copyId)).toBe(false);
      reserved.add(entry.copyId);
    }
  }
  expect(revised.toJSON().studio.componentOrigins!.map((origin) => origin.source)).toEqual([
    document.studio.componentOrigins![0]!.source,
    document.studio.componentOrigins![0]!.source,
    document.studio.componentOrigins![0]!.source,
  ]);
});

it("rejects tampered raster origins and exposes missing or detached instances without guessing mappings", () => {
  const { project, instanceId } = fixture();
  const tampered = project.toJSON();
  const root = tampered.studio.componentOrigins![0]!.source[0]!;
  if (root.kind !== "group" || root.children[0]!.kind === "group") throw new Error("Missing paint");
  const element = root.children[0]!.elements[0]!;
  if (element.kind !== "raster-surface") throw new Error("Missing pixels");
  element.pixels[0] = 1;
  expect(() => StoryboardProject.fromJSON(tampered)).toThrow(
    expect.objectContaining({
      code: "INVALID_ARGUMENT",
      details: expect.objectContaining({ reason: "COMPONENT_ORIGIN_CHECKSUM" }),
    }),
  );
  const detached = project.toJSON();
  delete detached.panels[0]!.layers.find((layer) => layer.id === instanceId)!.componentSource;
  expect(StoryboardProject.fromJSON(detached).componentOriginData(instanceId).instanceState).toBe(
    "detached",
  );
  const removed = project.toJSON();
  removed.panels[0]!.layers = removed.panels[0]!.layers.filter((layer) => layer.id !== instanceId);
  expect(StoryboardProject.fromJSON(removed).componentOriginData(instanceId).instanceState).toBe(
    "missing",
  );
});
