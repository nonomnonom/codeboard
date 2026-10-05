import { expect, it } from "vitest";
import { StoryboardProject, renderFramePNG } from "../../../../src/index.js";
import { fixture } from "./fixture.js";

it("plans sparse camera and layer channels, preserves key identity and rejects frame collisions atomically", async () => {
  const { project, path, panel, layer } = await fixture(),
    shotId = project.toJSON().panels[0]!.shotId;
  const plan = project.plan("Camera and acting", [
    { op: "camera.key", shotId, frame: 0, value: { x: 0, zoom: 1 } },
    { op: "camera.key", shotId, frame: 12, value: { x: 4, zoom: 1.2, easing: "ease-in-out" } },
    { op: "layer.key", layerId: layer.id, frame: 0, value: { transform: { x: 0 }, opacity: 1 } },
    { op: "layer.key", layerId: layer.id, frame: 12, value: { transform: { x: 8 }, opacity: 0.5 } },
  ]);
  await project.commit(plan, { requestId: "keys" });
  const camera = project.production.cameraKeyframes(shotId)[1]!,
    key = project.production.layerKeyframes(layer.id)[1]!;
  const before = project.toJSON();
  expect(() =>
    project.plan("Collision", [
      { op: "panel.revise", id: panel.id, changes: { dialogue: "discard" } },
      { op: "camera.key.update", shotId, id: camera.id, changes: { frame: 0 } },
    ]),
  ).toThrow();
  expect(() =>
    project.plan("Empty channel", [
      { op: "layer.key", layerId: layer.id, frame: 8, value: { easing: "hold" } },
    ]),
  ).toThrow();
  expect(() =>
    project.plan("Unknown channel", [
      { op: "camera.key", shotId, frame: 8, value: { typo: 1 } as never },
    ]),
  ).toThrow();
  expect(project.toJSON()).toEqual(before);
  const revise = project.plan("Refine channels", [
    { op: "camera.key", shotId, frame: 12, value: { y: 3, easing: "hold" } },
    { op: "camera.key.update", shotId, id: camera.id, changes: { zoom: 1.4 } },
    { op: "camera.key.removeChannels", shotId, id: camera.id, channels: ["x"] },
    { op: "layer.key", layerId: layer.id, frame: 12, value: { transform: { rotation: 0.2 } } },
    { op: "layer.key.update", layerId: layer.id, id: key.id, changes: { opacity: 0.7 } },
    { op: "layer.key.removeChannels", layerId: layer.id, id: key.id, channels: ["x"] },
  ]);
  await project.commit(JSON.parse(JSON.stringify(revise)), { requestId: "refine" });
  expect(project.production.cameraKeyframes(shotId)[1]).toMatchObject({
    id: camera.id,
    y: 3,
    zoom: 1.4,
    channelEasing: { y: "hold" },
  });
  expect(project.production.cameraKeyframes(shotId)[1]).not.toHaveProperty("x");
  expect(project.production.layerKeyframes(layer.id)[1]).toMatchObject({
    id: key.id,
    opacity: 0.7,
    transform: { rotation: 0.2 },
  });
  expect(project.production.layerKeyframes(layer.id)[1]!.transform).not.toHaveProperty("x");
  const reopened = await StoryboardProject.open(path);
  for (const frame of [12, 0, 6])
    expect(await renderFramePNG(reopened, frame)).toEqual(await renderFramePNG(project, frame));
  expect((await reopened.commit(revise, { requestId: "refine" })).replayed).toBe(true);
  const remove = reopened.plan("Remove terminal keys", [
    { op: "camera.key.remove", shotId, id: camera.id },
    { op: "layer.key.remove", layerId: layer.id, id: key.id },
  ]);
  await reopened.commit(remove, { requestId: "remove-keys" });
  expect(reopened.production.cameraKeyframes(shotId)).toHaveLength(1);
  expect(reopened.production.layerKeyframes(layer.id)).toHaveLength(1);
});

it("commits exposure and rig revisions as one recoverable transaction without changing unrelated drawings", async () => {
  const { project, path, panel } = await fixture();
  const drawings = panel.addGroup("Drawings"),
    a = panel.addVectorLayer("A", {}, drawings.id),
    b = panel.addVectorLayer("B", {}, drawings.id);
  a.vectorStroke(
    [
      { x: 5, y: 5 },
      { x: 15, y: 5 },
    ],
    { color: "red", width: 3 },
  );
  b.vectorStroke(
    [
      { x: 5, y: 15 },
      { x: 15, y: 15 },
    ],
    { color: "blue", width: 3 },
  );
  const root = panel.addGroup("Arm"),
    elbow = panel.addGroup("Elbow", { transform: { x: 10 } }, root.id);
  panel.addVectorLayer("Hand", {}, elbow.id).vectorStroke(
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    { color: "green", width: 3 },
  );
  await project.save(path);
  const before = project.toJSON();
  const plan = project.plan("Animate drawings and arm", [
    { op: "drawing.sequence", id: drawings.id, keys: [{ frame: 0, drawingId: a.id }] },
    { op: "drawing.range", id: drawings.id, startFrame: 4, endFrame: 8, drawingId: b.id },
    { op: "layer.exposure", id: drawings.id, exposure: { startFrame: 0, endFrame: 12 } },
    { op: "layer.depth", id: drawings.id, depth: 2 },
    {
      op: "rig.define",
      id: root.id,
      definition: { elbowId: elbow.id, upperLength: 10, lowerLength: 10 },
    },
    { op: "rig.pose", id: root.id, frame: 4, target: { x: 10, y: 10 }, bend: -1 },
  ]);
  expect(project.toJSON()).toEqual(before);
  await project.commit(JSON.parse(JSON.stringify(plan)), { requestId: "animation" });
  expect(project.production.drawingSequence(drawings.id).keys).toEqual([
    { frame: 0, drawingId: a.id },
    { frame: 4, drawingId: b.id },
    { frame: 8, drawingId: a.id },
  ]);
  expect(project.production.layer(drawings.id)).toMatchObject({
    depth: 2,
    exposure: { startFrame: 0, endFrame: 12 },
  });
  expect(project.production.layerKeyframes(root.id)).toHaveLength(1);
  expect(project.production.layerKeyframes(elbow.id)).toHaveLength(1);
  const reopened = await StoryboardProject.open(path);
  for (const frame of [0, 4, 8, 12])
    expect(await renderFramePNG(reopened, frame)).toEqual(await renderFramePNG(project, frame));
  expect(reopened.toJSON().panels[0]!.layers[0]).toEqual(before.panels[0]!.layers[0]);
  const committed = reopened.toJSON();
  expect(() =>
    reopened.plan("Invalid drawing", [
      { op: "drawing.range", id: drawings.id, startFrame: 2, endFrame: 5, drawingId: elbow.id },
    ]),
  ).toThrow();
  expect(() =>
    reopened.plan("Invalid rig", [
      {
        op: "rig.define",
        id: root.id,
        definition: { elbowId: a.id, upperLength: 10, lowerLength: 10 },
      },
    ]),
  ).toThrow();
  expect(reopened.toJSON()).toEqual(committed);
  expect((await reopened.commit(plan, { requestId: "animation" })).replayed).toBe(true);
});
