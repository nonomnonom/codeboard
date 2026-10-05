import { expect, it } from "vitest";
import {
  StoryboardProject,
  renderFramePNG,
  brushes,
  planDrawingElement,
  pathCommands,
} from "../../../../src/index.js";
import { fixture } from "./fixture.js";

it("plans brush versions, explicit component refresh, review retention and actor-owned locks", async () => {
  const { project, path, panel, layer } = await fixture(),
    originalLayer = project.production.layer(layer.id);
  const { version: _version, ...definition } = brushes.cleanInk;
  const setup = project.plan("Prepare reusable artwork", [
    { op: "brush.create", definition: { ...definition, id: "brush:studio", name: "Studio ink" } },
    { op: "brush.revise", id: "brush:studio", changes: { size: 9 } },
    { op: "brush.duplicate", id: "brush:studio", name: "Studio ink copy" },
    { op: "component.capture", layerId: layer.id, id: "component:ink", name: "Ink component" },
    {
      op: "component.instantiate",
      componentId: "component:ink",
      panelId: panel.id,
      id: "instance:ink",
      transform: { x: 3 },
    },
  ]);
  await project.commit(JSON.parse(JSON.stringify(setup)), { requestId: "library" });
  expect(project.production.brush("brush:studio")).toMatchObject({ size: 9, version: 2 });
  expect(project.production.layer(layer.id)).toEqual(originalLayer);
  const instance = project.production.layer("instance:ink");
  if (instance.kind !== "group" || instance.children[0]!.kind === "group")
    throw new Error("fixture");
  const child = instance.children[0]!,
    element = child.elements[0]!;
  const review = project.plan("Review instance", [
    {
      op: "review.comment",
      body: "Retain this note",
      anchor: { panelId: panel.id, elementId: element.id },
    },
    { op: "lock.acquire", targetType: "layer", targetId: child.id, reason: "Review in progress" },
  ]);
  await project.commit(review, { requestId: "review" });
  const doc = project.toJSON(),
    lock = doc.locks[0]!,
    comment = doc.comments[0]!;
  expect(comment.author).toBe(project.actor);
  expect(lock.owner).toBe(project.actor);
  expect(() =>
    project.plan("Locked refresh", [
      { op: "component.refresh", id: instance.id, comments: "anchor-to-instance" },
    ]),
  ).toThrow(/locked/);
  const other = await StoryboardProject.open(path, { actor: "agent:other" });
  expect(() => other.plan("Wrong owner", [{ op: "lock.release", id: lock.id }])).toThrow(/Only/);
  await project.commit(project.plan("Release review lock", [{ op: "lock.release", id: lock.id }]), {
    requestId: "unlock",
  });
  layer.set({ opacity: 0.5 });
  await project.save(path);
  await project.commit(
    project.plan("Publish new component source", [
      { op: "component.revise", id: "component:ink", sourceLayerId: layer.id },
    ]),
    { requestId: "revise-component" },
  );
  const before = project.toJSON();
  expect(() =>
    project.plan("Protected notes", [
      { op: "component.refresh", id: instance.id, comments: "reject" },
    ]),
  ).toThrow(/comments/);
  expect(project.toJSON()).toEqual(before);
  const refresh = project.plan("Refresh retaining notes", [
    { op: "component.refresh", id: instance.id, comments: "anchor-to-instance" },
    { op: "review.resolve", id: comment.id },
  ]);
  await project.commit(refresh, { requestId: "refresh" });
  const reopened = await StoryboardProject.open(path),
    updated = reopened.production.layer(instance.id);
  expect(updated).toMatchObject({
    transform: { x: 3 },
    componentSource: { id: "component:ink", version: 2 },
  });
  if (updated.kind !== "group") throw new Error("fixture");
  expect(updated.children[0]).toMatchObject({ opacity: 0.5 });
  expect(updated.children[0]!.id).not.toBe(child.id);
  expect(reopened.toJSON().comments[0]).toMatchObject({
    id: comment.id,
    status: "resolved",
    anchor: { panelId: panel.id, layerId: instance.id },
  });
  expect(reopened.toJSON().comments[0]!.anchor).not.toHaveProperty("elementId");
  expect((await reopened.commit(refresh, { requestId: "refresh" })).replayed).toBe(true);
  expect(await renderFramePNG(reopened, 0)).toEqual(await renderFramePNG(project, 0));
});

it("authors portable vector/text/brush elements, outlines and combines contours, and revises one object after restart", async () => {
  const { project, path, panel, layer } = await fixture();
  const vector = panel.addVectorLayer("Vector");
  await project.save(path);
  const source = project.production.layer(layer.id);
  if (source.kind === "group") throw new Error("fixture");
  const brush = source.elements[0]!;
  const text = planDrawingElement({
    kind: "text",
    id: "text:line",
    text: "A",
    x: 10,
    y: 20,
    color: "black",
    font: "12px sans-serif",
    align: "left",
    opacity: 1,
    visible: true,
  });
  const plan = project.plan("Author artwork", [
    {
      op: "element.add",
      panelId: panel.id,
      layerId: layer.id,
      element: planDrawingElement({ ...brush, id: "brush:copy" }),
    },
    { op: "element.add", panelId: panel.id, layerId: vector.id, element: text },
    {
      op: "element.add",
      panelId: panel.id,
      layerId: vector.id,
      element: planDrawingElement({
        kind: "vector-stroke",
        id: "stroke:outline",
        points: [
          { x: 5, y: 5 },
          { x: 20, y: 5 },
        ],
        color: "red",
        width: 4,
        opacity: 1,
        taperStart: 0,
        taperEnd: 0,
        pressureSize: 0,
        closed: false,
        visible: true,
      }),
    },
    { op: "element.outline", panelId: panel.id, layerId: vector.id, id: "stroke:outline" },
    {
      op: "element.boolean",
      panelId: panel.id,
      layerId: vector.id,
      id: "stroke:outline",
      tool: pathCommands("M 8 0 L 15 0 L 15 10 L 8 10 Z"),
      operation: "intersect",
    },
  ]);
  await project.commit(JSON.parse(JSON.stringify(plan)), { requestId: "art" });
  expect(project.production.element("stroke:outline").kind).toBe("vector-path");
  const reopened = await StoryboardProject.open(path),
    before = reopened.toJSON(),
    image = await renderFramePNG(reopened, 0);
  expect(image).toEqual(await renderFramePNG(project, 0));
  const revised = reopened.production.element("text:line");
  if (revised.kind !== "text") throw new Error("fixture");
  const edit = reopened.plan("Second-agent correction", [
    {
      op: "element.replace",
      panelId: panel.id,
      layerId: vector.id,
      id: revised.id,
      element: planDrawingElement({ ...revised, text: "B", color: "blue" }),
    },
  ]);
  await reopened.commit(edit, { requestId: "one-object" });
  const current = await StoryboardProject.open(path);
  expect(await renderFramePNG(current, 0)).not.toEqual(image);
  expect(current.production.layer(layer.id)).toEqual(before.panels[0]!.layers[0]);
  expect(current.production.element("stroke:outline")).toEqual(
    project.production.element("stroke:outline"),
  );
  expect((await current.commit(edit, { requestId: "one-object" })).replayed).toBe(true);
  expect(() =>
    current.plan("Change identity", [
      {
        op: "element.replace",
        panelId: panel.id,
        layerId: vector.id,
        id: revised.id,
        element: planDrawingElement({ ...revised, id: "different" }),
      },
    ]),
  ).toThrow(/stable id/);
  await current.commit(
    current.plan("Remove brush copy", [
      { op: "element.remove", panelId: panel.id, layerId: layer.id, ids: ["brush:copy"] },
    ]),
    { requestId: "remove-brush" },
  );
  expect(() => current.production.element("brush:copy")).toThrow();
});

it("preserves exact RGBA bytes in JSON plans and rejects malformed or out-of-bounds pixel patches", async () => {
  const { project, path, panel, layer } = await fixture();
  const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 64, 1, 2, 3, 0]);
  const element = planDrawingElement({
    kind: "raster-surface",
    id: "pixels:surface",
    width: 2,
    height: 2,
    pixels,
    matrix: [8, 0, 0, 8, 4, 4],
    opacity: 1,
    visible: true,
  });
  const add = project.plan("Pixel artwork", [
    { op: "element.add", panelId: panel.id, layerId: layer.id, element },
  ]);
  await project.commit(JSON.parse(JSON.stringify(add)), { requestId: "pixel-art" });
  const before = project.toJSON(),
    image = await renderFramePNG(project, 0),
    replacement = Buffer.from([40, 50, 60, 70]).toString("base64");
  const patch = {
    op: "pixels.patch" as const,
    panelId: panel.id,
    layerId: layer.id,
    id: "pixels:surface",
    region: { x: 1, y: 0, width: 1, height: 1 },
    pixelsBase64: replacement,
  };
  expect(() =>
    project.plan("Outside", [{ ...patch, region: { x: 2, y: 0, width: 1, height: 1 } }]),
  ).toThrow(/inside/);
  expect(() => project.plan("Wrong size", [{ ...patch, pixelsBase64: "AA==" }])).toThrow(/RGBA8/);
  expect(() =>
    project.plan("Noncanonical", [{ ...patch, pixelsBase64: replacement.replace(/=/g, "") }]),
  ).toThrow(/base64/);
  expect(project.toJSON()).toEqual(before);
  const plan = project.plan("Patch one pixel", [patch]);
  await project.commit(JSON.parse(JSON.stringify(plan)), { requestId: "pixel-patch" });
  const reopened = await StoryboardProject.open(path),
    result = reopened.production.element("pixels:surface");
  if (result.kind !== "raster-surface") throw new Error("fixture");
  expect([...result.pixels]).toEqual([255, 0, 0, 255, 40, 50, 60, 70, 0, 0, 255, 64, 1, 2, 3, 0]);
  expect(await renderFramePNG(reopened, 0)).not.toEqual(image);
  expect(await renderFramePNG(reopened, 0)).toEqual(await renderFramePNG(project, 0));
  expect((await reopened.commit(plan, { requestId: "pixel-patch" })).replayed).toBe(true);
  expect(() =>
    reopened.plan("Ambiguous bytes", [
      {
        op: "element.replace",
        panelId: panel.id,
        layerId: layer.id,
        id: result.id,
        element: { ...element, pixels: [1, 2, 3] } as never,
      },
    ]),
  ).toThrow();
});
