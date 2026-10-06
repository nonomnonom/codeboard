import { expect, it } from "vitest";
import {
  createRenderSession,
  createShotRenderSession,
  retimeShotAnimation,
} from "../../../src/index.js";
import { element, pixels, scene, setup } from "./helpers.js";

it("captures board-global keys into local time and preserves pictures when stretching the shot", () => {
  const spec = scene();
  for (const key of spec.nodes[0]!.keyframes!) key.frame += 12;
  const { project, panel } = setup(spec, 12);
  const expected = pixels(createRenderSession(project).frame(17));
  project.capturePanelAnimation(panel.id, { id: "motion" });
  const animation = project.shotAnimation("motion");
  expect(pixels(createShotRenderSession(animation).frame(5))).toEqual(expected);
  const { animation: longer } = retimeShotAnimation(animation, {
    durationFrames: 22,
    rounding: "nearest",
    audio: "preserve-seconds",
  });
  expect(pixels(createShotRenderSession(longer).frame(10))).toEqual(expected);
  expect(animation.durationFrames).toBe(11);
});

it("ripples and rescales 3D keys with board duration and frame-rate changes", () => {
  const spec = scene();
  for (const key of spec.nodes[0]!.keyframes!) key.frame += 12;
  const { project } = setup(spec, 12);
  const firstId = project.toJSON().panels[0]!.id;
  const expected = pixels(createRenderSession(project).frame(17));
  project.production.setPanelDuration(firstId, 24);
  expect(element(project, 1).scene.nodes[0]!.keyframes!.map((key) => key.frame)).toEqual([24, 34]);
  expect(pixels(createRenderSession(project).frame(29))).toEqual(expected);
  project.configure({ frameRate: { value: 48, timing: "preserve-seconds" } });
  expect(element(project, 1).scene.nodes[0]!.keyframes!.map((key) => key.frame)).toEqual([48, 68]);
  expect(pixels(createRenderSession(project).frame(58))).toEqual(expected);
});

it("rejects collapsing 3D keys atomically during panel retiming", () => {
  const spec = scene();
  spec.nodes[0]!.keyframes![1]!.frame = 1;
  const { project, panel } = setup(spec);
  const before = project.toJSON();
  expect(() => project.production.setPanelDuration(panel.id, 1)).toThrow(/collaps/i);
  expect(project.toJSON()).toEqual(before);
});

it("moves 3D keys with a reordered panel and restores them on undo", () => {
  const spec = scene();
  for (const key of spec.nodes[0]!.keyframes!) key.frame += 12;
  const { project, panel } = setup(spec, 12);
  const before = pixels(createRenderSession(project).frame(17));
  project.production.movePanel(panel.id, project.toJSON().panels[0]!.id);
  expect(element(project).scene.nodes[0]!.keyframes!.map((key) => key.frame)).toEqual([0, 10]);
  expect(pixels(createRenderSession(project).frame(5))).toEqual(before);
  project.undo();
  expect(element(project, 1).scene.nodes[0]!.keyframes!.map((key) => key.frame)).toEqual([12, 22]);
});
