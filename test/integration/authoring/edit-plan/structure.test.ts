import { expect, it } from "vitest";
import { StoryboardProject, ProjectStore } from "../../../../src/index.js";
import { fixture } from "./fixture.js";

it("builds and restructures a sequence with stable IDs while maintaining timeline and ownership", async () => {
  const { project, path } = await fixture(),
    before = project.toJSON();
  const plan = project.plan("Build production structure", [
    { op: "sequence.add", id: "seq:episode", name: "Episode" },
    { op: "scene.add", sequenceId: "seq:episode", id: "scene:intro", name: "Introduction" },
    { op: "shot.add", sceneId: "scene:intro", id: "shot:wide", name: "Wide" },
    { op: "shot.add", sceneId: "scene:intro", id: "shot:close", name: "Close" },
    { op: "panel.add", shotId: "shot:wide", options: { id: "panel:a", durationFrames: 12 } },
    { op: "panel.add", shotId: "shot:wide", options: { id: "panel:b", durationFrames: 12 } },
    { op: "panel.add", shotId: "shot:close", options: { id: "panel:c", durationFrames: 12 } },
    {
      op: "layer.add",
      panelId: "panel:a",
      kind: "group",
      name: "Character",
      options: { id: "layer:group", transform: { x: 5 } },
    },
    {
      op: "layer.add",
      panelId: "panel:a",
      kind: "vector",
      name: "Ink",
      options: { id: "layer:ink" },
      parentId: "layer:group",
    },
    {
      op: "layer.add",
      panelId: "panel:a",
      kind: "raster",
      name: "Paint",
      options: { id: "layer:paint" },
    },
    { op: "layer.reparent", id: "layer:ink", parentId: null, beforeId: "layer:group" },
    { op: "layer.move", id: "layer:paint", beforeId: "layer:ink" },
    { op: "layer.remove", id: "layer:group" },
    { op: "panel.duration", id: "panel:a", durationFrames: 24, mode: "ripple" },
    { op: "panel.move", id: "panel:b", beforeId: "panel:a" },
    { op: "panel.transition", id: "panel:a", transition: { type: "dissolve", durationFrames: 4 } },
    { op: "panel.number", id: "panel:a", number: "010A" },
  ]);
  expect(project.toJSON()).toEqual(before);
  await project.commit(JSON.parse(JSON.stringify(plan)), { requestId: "structure" });
  const reopened = await StoryboardProject.open(path),
    doc = reopened.toJSON();
  expect(
    doc.panels.map((panel) => [panel.id, panel.startFrame, panel.durationFrames]).slice(1),
  ).toEqual([
    ["panel:b", 24, 12],
    ["panel:a", 36, 24],
    ["panel:c", 60, 12],
  ]);
  expect(doc.panels.find((panel) => panel.id === "panel:a")).toMatchObject({
    number: "010A",
    transition: { type: "dissolve", durationFrames: 4 },
    layers: [{ id: "layer:paint" }, { id: "layer:ink" }],
  });
  expect(
    reopened.production.query({ parentId: "scene:intro" }).items.map((item) => item.id),
  ).toEqual(["shot:wide", "shot:close"]);
  expect((await reopened.commit(plan, { requestId: "structure" })).replayed).toBe(true);
  const state = reopened.toJSON();
  expect(() =>
    reopened.plan("Duplicate ID", [{ op: "sequence.add", id: "seq:episode", name: "Duplicate" }]),
  ).toThrow();
  expect(() =>
    reopened.plan("Invalid parent", [
      {
        op: "layer.add",
        panelId: "panel:a",
        kind: "vector",
        name: "Bad",
        options: { id: "layer:bad" },
        parentId: "layer:ink",
      },
    ]),
  ).toThrow(/group/);
  expect(() =>
    reopened.plan("Cross-shot move", [{ op: "panel.move", id: "panel:a", beforeId: "panel:c" }]),
  ).toThrow(/shot/);
  expect(reopened.toJSON()).toEqual(state);
  await reopened.commit(
    reopened.plan("Duplicate panel", [{ op: "panel.duplicate", id: "panel:a" }]),
    { requestId: "duplicate" },
  );
  const copied = reopened.toJSON().panels.find((panel) => panel.title.endsWith(" copy"))!;
  expect(copied).toBeDefined();
  expect(copied.layers[0]!.id).not.toBe("layer:paint");
  await reopened.commit(
    reopened.plan("Remove duplicate", [{ op: "panel.remove", id: copied.id }]),
    { requestId: "remove-copy" },
  );
  const content = (panels: typeof state.panels) => panels.map(({ revision, ...panel }) => panel);
  expect(content(reopened.toJSON().panels)).toEqual(content(state.panels));
  expect(reopened.toJSON().panels.find((panel) => panel.id === "panel:c")!.revision).toBe(
    state.panels.find((panel) => panel.id === "panel:c")!.revision + 2,
  );
  using store = ProjectStore.open(path);
  store.verify();
});
