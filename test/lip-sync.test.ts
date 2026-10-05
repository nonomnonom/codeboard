import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compileLipSync,
  planShotLipSync,
  StoryboardProject,
  evaluateDrawing,
  renderShotFramePNG,
} from "../src/index.js";

it("bakes cue gaps, explicit blanks and manual corrections with exclusive end boundaries", () => {
  const input = {
    startFrame: 0,
    endFrame: 12,
    mouths: { A: "open", B: "wide" },
    restDrawingId: "closed",
    cues: [
      { startFrame: 2, endFrame: 7, mouth: "A" },
      { startFrame: 7, endFrame: 10, mouth: "B" },
    ],
    corrections: [{ startFrame: 4, endFrame: 5, drawingId: null }],
  };
  const before = structuredClone(input);
  const keys = compileLipSync(input);
  expect(keys).toEqual([
    { frame: 0, drawingId: "closed" },
    { frame: 2, drawingId: "open" },
    { frame: 4, drawingId: null },
    { frame: 5, drawingId: "open" },
    { frame: 7, drawingId: "wide" },
    { frame: 10, drawingId: "closed" },
  ]);
  expect(input).toEqual(before);
});

it("rejects unmapped or overlapping cues and invalid correction ranges", () => {
  const input = {
    startFrame: 0,
    endFrame: 12,
    mouths: { A: "open" },
    restDrawingId: null,
    cues: [{ startFrame: 2, endFrame: 7, mouth: "A" }],
  };
  expect(() =>
    compileLipSync({ ...input, cues: [{ startFrame: 0, endFrame: 1, mouth: "missing" }] }),
  ).toThrow(/Unmapped/);
  expect(() =>
    compileLipSync({
      ...input,
      cues: [...input.cues, { startFrame: 6, endFrame: 10, mouth: "A" }],
    }),
  ).toThrow(/nonoverlapping/);
  expect(() =>
    compileLipSync({ ...input, corrections: [{ startFrame: 10, endFrame: 13, drawingId: null }] }),
  ).toThrow(/inside/);
});

it("persists editable shot lip-sync and manual correction while retaining surrounding exposures", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-lip-sync-"));
  try {
    const project = StoryboardProject.create({ title: "Mouth cues", width: 32, height: 32 });
    const panel = project.addScene("Scene").addShot("Shot").addPanel({ durationFrames: 24 });
    const mouth = panel.addGroup("Mouth");
    const rest = panel.addVectorLayer("Rest", {}, mouth.id);
    const open = panel.addVectorLayer("Open", {}, mouth.id);
    for (const [drawing, color] of [
      [rest, "blue"],
      [open, "red"],
    ] as const)
      drawing.path(
        [{ op: "M", x: 4, y: 4 }, { op: "L", x: 20, y: 4 }, { op: "L", x: 20, y: 20 }, { op: "Z" }],
        { fill: color },
      );
    project.production.setDrawingSequence(mouth.id, [
      { frame: 0, drawingId: rest.id },
      { frame: 20, drawingId: open.id },
    ]);
    project.capturePanelAnimation(panel.id, { id: "animation" });
    const group = project.shotAnimation("animation").layers[0]!;
    if (group.kind !== "group") throw new Error("Expected mouth group");
    const restId = group.children.find((child) => child.name === "Rest")!.id;
    const openId = group.children.find((child) => child.name === "Open")!.id;
    const file = join(directory, "mouth.cboard");
    await project.save(file);
    const plan = planShotLipSync(project, "animation", group.id, {
      startFrame: 4,
      endFrame: 16,
      mouths: { A: openId },
      restDrawingId: restId,
      cues: [{ startFrame: 4, endFrame: 14, mouth: "A" }],
      corrections: [{ startFrame: 8, endFrame: 10, drawingId: restId }],
    });
    const first = await project.commit(plan, { requestId: "mouth-pass" });
    const opened = await StoryboardProject.open(file);
    expect(await opened.commit(plan, { requestId: "mouth-pass" })).toEqual({
      ...first,
      replayed: true,
    });
    const animation = opened.shotAnimation("animation"),
      edited = animation.layers[0]!;
    if (edited.kind !== "group") throw new Error("Expected group");
    for (const [frame, expected] of [
      [0, restId],
      [4, openId],
      [8, restId],
      [10, openId],
      [14, restId],
      [16, restId],
      [20, openId],
    ] as const)
      expect(evaluateDrawing(edited.drawingSequence, frame)).toBe(expected);
    const restPNG = await renderShotFramePNG(animation, 0);
    expect(await renderShotFramePNG(animation, 8)).toEqual(restPNG);
    expect(await renderShotFramePNG(animation, 4)).not.toEqual(restPNG);
    expect(edited.children).toEqual(group.children);
    expect(opened.toJSON().panels).toEqual(project.toJSON().panels);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
