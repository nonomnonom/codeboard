import { expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StoryboardProject, planScriptBoard } from "../../../src/index.js";

function fixture() {
  const project = StoryboardProject.create({ title: "Staging" });
  const shot = project.addScene("Room").addShot("Door");
  const panel = shot.addPanel({ title: "Existing drawing", durationFrames: 24 });
  panel.addVectorLayer("Ink").path(
    [
      { op: "M", x: 0, y: 0 },
      { op: "L", x: 10, y: 10 },
    ],
    { stroke: "red", strokeWidth: 2 },
  );
  project.replaceScript(
    {
      id: "script",
      title: "Door",
      entries: [
        { id: "heading", kind: "scene", text: "INT. ROOM", panelIds: [] },
        { id: "action", kind: "action", text: "A knock at the door.", panelIds: [panel.id] },
        { id: "line", kind: "dialogue", text: "Come in.", speaker: "Mira", panelIds: [] },
      ],
    },
    0,
  );
  return { project, shot, panel };
}

it("creates staged panels and script links atomically, with restart-safe retry and no inferred artwork", async () => {
  const { project, shot, panel } = fixture();
  const dir = await mkdtemp(join(tmpdir(), "codeboard-script-board-"));
  try {
    const file = join(dir, "board.cboard");
    await project.save(file);
    const before = project.toJSON();
    const report = planScriptBoard(project, [
      {
        panelId: "new:knock",
        shotId: shot.id,
        entryIds: ["heading", "action"],
        durationFrames: 48,
      },
      { panelId: "new:reply", shotId: shot.id, entryIds: ["line"], durationFrames: 36 },
    ]);
    expect(project.toJSON()).toEqual(before);
    const first = await project.commit(report.plan, { requestId: "stage-board" });
    const opened = await StoryboardProject.open(file);
    expect(await opened.commit(report.plan, { requestId: "stage-board" })).toEqual({
      ...first,
      replayed: true,
    });
    const panels = opened.toJSON().panels;
    expect(panels[0]).toEqual(before.panels[0]);
    expect(
      panels.slice(1).map(({ id, startFrame, durationFrames, layers }) => ({
        id,
        startFrame,
        durationFrames,
        layers,
      })),
    ).toEqual([
      { id: "new:knock", startFrame: 24, durationFrames: 48, layers: [] },
      { id: "new:reply", startFrame: 72, durationFrames: 36, layers: [] },
    ]);
    expect(opened.panelCaptions("new:knock")).toMatchObject({
      title: "INT. ROOM",
      action: "A knock at the door.",
    });
    expect(opened.panelCaptions("new:reply").dialogue).toBe("Mira: Come in.");
    expect(opened.scriptEntries().find((entry) => entry.id === "action")!.panelIds).toEqual([
      panel.id,
      "new:knock",
    ]);
    expect(opened.scriptSummary()?.revision).toBe(2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it("rejects ID collisions, unknown targets and invalid staging without changing source", () => {
  const { project, shot, panel } = fixture();
  const before = project.toJSON();
  const valid = { panelId: "new", shotId: shot.id, entryIds: ["line"], durationFrames: 24 };
  for (const request of [
    { ...valid, panelId: panel.id },
    { ...valid, shotId: "missing" },
    { ...valid, entryIds: ["missing"] },
    { ...valid, durationFrames: 0 },
    { ...valid, entryIds: ["line", "line"] },
  ])
    expect(() => planScriptBoard(project, [request])).toThrow();
  expect(() => planScriptBoard(project, [valid, valid])).toThrow();
  expect(project.toJSON()).toEqual(before);
});
