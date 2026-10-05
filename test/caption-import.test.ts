import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StoryboardProject, parseCaptionCSV, planCaptionImport } from "../src/index.js";

it("imports quoted multiline captions with stable IDs and a field report through restart/retry", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codeboard-captions-"));
  try {
    const project = StoryboardProject.create({ title: "Caption import" });
    const panel = project
      .addScene("Scene")
      .addShot("Shot")
      .addPanel({ id: "panel:first", action: "Original action", dialogue: "Old line" });
    panel.addVectorLayer("Drawing").path(
      [
        { op: "M", x: 0, y: 0 },
        { op: "L", x: 10, y: 10 },
      ],
      { stroke: "red", strokeWidth: 2 },
    );
    project.capturePanelAnimation(panel.id, { id: "animation" });
    const file = join(dir, "project.cboard");
    await project.save(file);
    const before = project.toJSON();
    const rows = parseCaptionCSV(
      '\uFEFFpanelId,dialogue,notes\r\npanel:first,"Hello, ""friend""\nCome in.",\r\n',
    );
    const report = planCaptionImport(project, rows);
    expect(report.changes).toEqual([
      {
        panelId: panel.id,
        field: "dialogue",
        before: "Old line",
        after: 'Hello, "friend"\nCome in.',
      },
    ]);
    expect(project.toJSON()).toEqual(before);
    if (!report.plan) throw new Error("Expected revision plan");
    const serialized = JSON.parse(JSON.stringify(report.plan));
    const receipt = await project.commit(serialized, { requestId: "caption-import" });
    const reopened = await StoryboardProject.open(file);
    expect(await reopened.commit(serialized, { requestId: "caption-import" })).toEqual({
      ...receipt,
      replayed: true,
    });
    const after = reopened.toJSON();
    expect(after.panels[0]!.layers).toEqual(before.panels[0]!.layers);
    expect(after.panels[0]!.durationFrames).toBe(before.panels[0]!.durationFrames);
    expect(after.studio).toEqual(before.studio);
    expect(reopened.panelCaptions(panel.id).action).toBe("Original action");
    expect(planCaptionImport(reopened, rows)).toMatchObject({
      plan: null,
      changes: [],
      unchangedPanelIds: [panel.id],
    });
    const clear = planCaptionImport(reopened, [{ panelId: panel.id, dialogue: "" }]);
    expect(clear.changes[0]!.after).toBe("");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it("rejects ambiguous IDs, unsupported columns and malformed CSV without editing the project", () => {
  const project = StoryboardProject.create({ title: "Rejection" });
  const panel = project.addScene("Scene").addShot("Shot").addPanel();
  const before = project.toJSON();
  expect(() =>
    planCaptionImport(project, [
      { panelId: panel.id, title: "Changed" },
      { panelId: "missing", title: "Unknown" },
    ]),
  ).toThrow(expect.objectContaining({ code: "INVALID_ARGUMENT" }));
  expect(() => planCaptionImport(project, [{ panelId: panel.id }, { panelId: panel.id }])).toThrow(
    /Duplicate panel/,
  );
  for (const csv of [
    "panelId,title,title\np,A,B",
    "panelId,durationFrames\np,20",
    'panelId,title\np,"unclosed',
    'panelId,title\np,"closed"trailing',
    "panelId,title\np,one,extra",
  ])
    expect(() => parseCaptionCSV(csv)).toThrow();
  expect(project.toJSON()).toEqual(before);
});

it("rejects oversized detail reads while allowing smaller pages without truncation", () => {
  const project = StoryboardProject.create({ title: "Response limits" });
  project.production.addAudioTrack("A".repeat(150000));
  project.production.addAudioTrack("B".repeat(150000));
  expect(() => project.production.audioTracks()).toThrow(
    expect.objectContaining({
      code: "RESOURCE_LIMIT",
      details: expect.objectContaining({ maxBytes: 262144 }),
    }),
  );
  expect(project.production.audioTracks({ limit: 1 })[0]!.name).toHaveLength(150000);
  expect(() => project.production.cameraKeyframes("missing")).toThrow(
    expect.objectContaining({ code: "INVALID_ARGUMENT" }),
  );
});
