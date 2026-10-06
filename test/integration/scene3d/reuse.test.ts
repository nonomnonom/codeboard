import { expect, it } from "vitest";
import {
  StoryboardProject,
  createRenderSession,
  createShotRenderSession,
} from "../../../src/index.js";
import { pixels, redBounds, scene, setup } from "./helpers.js";

it("captures the base pose as a static component and leaves source animation editable", () => {
  const { project, panel, layer } = setup();
  const componentId = project.production.captureComponent(layer.id, "Box");
  const source = project.toJSON().components.find((entry) => entry.id === componentId)!;
  const sourceLayer = source.layers[0]!;
  if (sourceLayer.kind === "group" || sourceLayer.elements[0]?.kind !== "scene-3d")
    throw new Error("Missing scene");
  expect(sourceLayer.elements[0].scene.nodes[0]!.keyframes).toBeUndefined();
  layer.set({ visible: false });
  project.production.instantiateComponent(componentId, panel.id);
  const render = createRenderSession(project);
  expect(redBounds(pixels(render.frame(0))).center).toBeCloseTo(64, 0);
  expect(redBounds(pixels(render.frame(10))).center).toBeCloseTo(64, 0);

  const invalid = structuredClone(sourceLayer.elements[0]);
  invalid.scene.nodes[0]!.keyframes = scene().nodes[0]!.keyframes!;
  const before = project.toJSON();
  expect(() =>
    project.production.replaceComponentElement(componentId, sourceLayer.id, invalid, {
      expectedComponentVersion: source.version,
    }),
  ).toThrow(/3D animation/);
  expect(project.toJSON()).toEqual(before);
});

it("offsets scene and camera animation when a character subtree is reused", () => {
  const project = StoryboardProject.create({
    title: "3D character reuse",
    width: 128,
    height: 128,
    background: "#ffffff",
    frameRate: 24,
  });
  const shot = project.addScene("Scene").addShot("Shot");
  const panel = shot.addPanel({ durationFrames: 11 });
  const root = panel.addGroup("Prop");
  const spec = scene();
  spec.camera.keyframes = [
    { frame: 0, position: [0, 0, 5], easing: "linear" },
    { frame: 10, position: [1, 0, 5], target: [1, 0, 0], easing: "linear" },
  ];
  panel.addVectorLayer("Solids", {}, root.id).scene3D(spec);
  const capture = project.capturePanelAnimation(panel.id, { id: "master" });
  const master = project.shotAnimation("master");
  project.putShotAnimation({
    id: "target",
    shotId: shot.id,
    name: "Target",
    durationFrames: 24,
    frameRate: master.frameRate,
    canvas: master.canvas,
    layers: [],
    cameraKeyframes: [],
  });
  project.instantiateShotCharacter("master", {
    id: "instance",
    targetAnimationId: "target",
    frameOffset: 8,
    rootLayerId: capture.identities.find((entry) => entry.sourceId === root.id)!.capturedId,
  });
  const original = createShotRenderSession(master);
  const copied = createShotRenderSession(project.shotAnimation("target"));
  expect(pixels(copied.frame(13))).toEqual(pixels(original.frame(5)));
  expect(pixels(copied.frame(18))).toEqual(pixels(original.frame(10)));
  expect(project.shotAnimation("master")).toEqual(master);
});
