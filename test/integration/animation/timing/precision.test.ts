import { expect, it } from "vitest";
import { StoryboardProject } from "../../../../src/index.js";
import { fixture } from "./fixture.js";

it("rounds large but representable key positions using the exact frame ratio", () => {
  const p = StoryboardProject.create({ title: "Frame precision" }),
    panel = p.addScene("S").addShot("S").addPanel({ durationFrames: 4 });
  const layer = panel.addVectorLayer("Ink");
  p.production.addLayerKeyframe(layer.id, 1, { opacity: 0.5 });
  p.production.setPanelDuration(panel.id, 9007199254739999);
  expect(p.production.layer(layer.id).keyframes[0]!.frame).toBe(3002399751579999);
});

it("rejects unsafe timing and unknown modes before a caught failure can affect an enclosing transaction", () => {
  const { p, a } = fixture();
  p.transaction("Recover from invalid timing", () => {
    const before = p.toJSON();
    for (const action of [
      () => p.production.setPanelDuration(a.id, Number.MAX_SAFE_INTEGER + 1),
      () => p.production.setPanelDuration(a.id, Number.MAX_SAFE_INTEGER),
      () => p.production.setPanelDuration(a.id, 48, "unknown" as never),
      () => a.revise({ durationFrames: Number.MAX_SAFE_INTEGER }),
    ]) {
      expect(action).toThrow(/safe integer|Unknown retiming/);
      expect(p.toJSON()).toEqual(before);
    }
    p.production.setPanelDuration(a.id, 36);
  });
  expect(p.toJSON().panels[1]!.startFrame).toBe(36);
  p.undo();
  expect(p.toJSON().panels[1]!.startFrame).toBe(24);
});

it("preflights far-future key overflow before moving any ordinary key or audio cue", () => {
  const { p, a, b } = fixture(),
    layer = b.addVectorLayer("Later key");
  p.production.addLayerKeyframe(layer.id, Number.MAX_SAFE_INTEGER - 1, { opacity: 0.5 });
  p.transaction("Recover from overflow", () => {
    const before = p.toJSON();
    expect(() => p.production.setPanelDuration(a.id, 48)).toThrow(/safe integer/);
    expect(p.toJSON()).toEqual(before);
    b.revise({ title: "Still editable" });
  });
  expect(p.toJSON().panels[1]!.title).toBe("Still editable");
});
