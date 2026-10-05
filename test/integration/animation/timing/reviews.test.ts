import { expect, it } from "vitest";
import { StoryboardProject } from "../../../../src/index.js";

it("keeps review frames with their content through reorder, duplication, deletion and undo", () => {
  const p = StoryboardProject.create({ title: "Review timing" }),
    shot = p.addScene("S").addShot("Shot");
  const a = shot.addPanel({ id: "a", durationFrames: 24 }),
    b = shot.addPanel({ id: "b", durationFrames: 48 });
  const anchored = p.production.comment("Check the hand", {
    panelId: b.id,
    frame: 30,
    x: 120,
    y: 80,
  });
  const timed = p.production.comment("Check the cue", { frame: 24 });
  p.production.comment("General composition", { panelId: b.id });
  const original = p.toJSON().comments;
  p.production.movePanel(b.id, a.id);
  expect(p.toJSON().comments.find((c) => c.id === anchored)?.anchor).toEqual({
    panelId: b.id,
    frame: 6,
    x: 120,
    y: 80,
  });
  expect(p.toJSON().comments.find((c) => c.id === timed)?.anchor.frame).toBe(0);
  p.undo();
  expect(p.toJSON().comments).toEqual(original);
  p.redo();
  expect(p.toJSON().comments.find((c) => c.id === anchored)?.anchor.frame).toBe(6);
  p.undo();
  const copy = p.production.duplicatePanel(a.id);
  expect(p.toJSON().comments.find((c) => c.id === anchored)?.anchor.frame).toBe(54);
  expect(p.toJSON().comments.find((c) => c.id === timed)?.anchor.frame).toBe(48);
  expect(p.toJSON().comments).toHaveLength(3);
  p.production.deletePanel(copy);
  expect(p.toJSON().comments).toEqual(original);
  p.production.deletePanel(b.id);
  expect(p.toJSON().comments).toHaveLength(0);
  p.undo();
  expect(p.toJSON().comments).toEqual(original);
});
