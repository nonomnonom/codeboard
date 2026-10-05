import { expect, it } from "vitest";
import { StoryboardProject, retimeShotAnimation } from "../../../src/index.js";

it("rejects key collisions without changing detached input or a project transaction", () => {
  const project = StoryboardProject.create({ title: "Retime", width: 16, height: 16 });
  const panel = project.addScene("Scene").addShot("Shot").addPanel({ durationFrames: 24 });
  const layer = panel.addVectorLayer("Ink");
  project.production.addLayerKeyframe(layer.id, 0, { transform: { x: 0 } });
  project.production.addLayerKeyframe(layer.id, 1, { transform: { x: 1 } });
  project.capturePanelAnimation(panel.id, { id: "animation" });
  const before = project.toJSON();
  const animation = project.shotAnimation("animation");
  const input = structuredClone(animation);
  const options = { durationFrames: 1, rounding: "nearest", audio: "preserve-seconds" } as const;
  const collision = expect.objectContaining({
    code: "INVALID_ARGUMENT",
    details: expect.objectContaining({ reason: "FRAME_COLLISION" }),
  });
  expect(() => retimeShotAnimation(animation, options)).toThrow(collision);
  expect(animation).toEqual(input);
  expect(() =>
    project.transaction("Atomic retime", () => {
      project.configure({ title: "Must roll back" });
      project.editShotAnimation("animation", [{ op: "timing.retime", ...options }]);
    }),
  ).toThrow(collision);
  expect(project.toJSON()).toEqual(before);
});
