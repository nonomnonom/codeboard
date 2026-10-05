import { expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StoryboardProject, ProjectStore, type ScriptInput } from "../../../src/index.js";

function fixture() {
  const project = StoryboardProject.create({ title: "Script" });
  const shot = project.addScene("Room").addShot("Door");
  const panel = shot.addPanel({ dialogue: "Board caption stays independent" });
  shot.addPanel();
  const script: ScriptInput = {
    id: "script:main",
    title: "Door",
    entries: [
      { id: "line:scene", kind: "scene", text: "INT. ROOM", panelIds: [panel.id] },
      {
        id: "line:dialogue",
        kind: "dialogue",
        text: "Come in.",
        speaker: "A",
        panelIds: [panel.id],
      },
    ],
  };
  return { project, panel, script };
}

it("revises script fields and order with stable IDs while preserving captions and artwork", () => {
  const { project, panel, script } = fixture();
  const before = project.toJSON().panels;
  const first = project.replaceScript(script, 0);
  expect(first).toMatchObject({
    beforeRevision: 0,
    revision: 1,
    added: ["line:scene", "line:dialogue"],
  });
  const version = project.version;
  expect(project.replaceScript(script, 1).revision).toBe(1);
  expect(project.version).toBe(version);
  script.entries[1]!.text = "Please come in.";
  script.entries.reverse();
  const report = project.replaceScript(script, 1);
  expect(report).toMatchObject({
    revision: 2,
    reordered: true,
    updated: [{ id: "line:dialogue", fields: ["text"] }],
    added: [],
    removed: [],
  });
  expect(project.toJSON().panels).toEqual(before);
  expect(project.panelCaptions(panel.id).dialogue).toBe("Board caption stays independent");
  const detached = project.scriptEntries({ limit: 1 });
  detached[0]!.panelIds.length = 0;
  expect(project.scriptEntries({ limit: 1 })[0]!.panelIds).toEqual([panel.id]);
  expect(project.undo()).toBe(true);
  expect(project.scriptSummary()?.revision).toBe(1);
  expect(project.redo()).toBe(true);
  expect(project.scriptSummary()?.revision).toBe(2);
});

it("persists script plans, catalog entries, checkpoints and retry receipts", async () => {
  const { project, script } = fixture();
  const directory = await mkdtemp(join(tmpdir(), "codeboard-script-"));
  try {
    const file = join(directory, "script.cboard");
    await project.save(file);
    const plan = project.plan("Import script", [
      { op: "script.replace", script, expectedRevision: 0 },
    ]);
    const result = await project.commit(JSON.parse(JSON.stringify(plan)), {
      requestId: "script-import",
    });
    const opened = await StoryboardProject.open(file);
    expect(opened.scriptSummary()).toMatchObject({ id: script.id, revision: 1, entryCount: 2 });
    expect(opened.scriptEntries()).toEqual(script.entries);
    expect(await opened.commit(plan, { requestId: "script-import" })).toEqual({
      ...result,
      replayed: true,
    });
    using store = ProjectStore.open(file);
    expect(store.query({ kind: "script-entry" }).items).toHaveLength(2);
    store.saveRevision("script-base", { expectedVersion: opened.version });
    store.compact();
    expect(store.readRevision("script-base").studio.script?.entries).toEqual(script.entries);
    store.verify();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("rejects conflicts and broken identities/links atomically, and permits explicit unlink then delete", () => {
  const { project, panel, script } = fixture();
  project.replaceScript(script, 0);
  const before = project.toJSON();
  expect(() => project.replaceScript(script, 0)).toThrow(
    expect.objectContaining({ code: "REVISION_CONFLICT" }),
  );
  const missing = structuredClone(script);
  missing.entries[0]!.panelIds = ["missing"];
  expect(() => project.replaceScript(missing, 1)).toThrow(/missing panel/);
  const duplicate = structuredClone(script);
  duplicate.entries[0]!.id = panel.id;
  expect(() => project.replaceScript(duplicate, 1)).toThrow(/Duplicate stable id/);
  expect(() => project.production.deletePanel(panel.id)).toThrow(/missing panel/);
  expect(project.toJSON()).toEqual(before);
  for (const entry of script.entries) entry.panelIds = [];
  project.transaction("Unlink deleted board", () => {
    project.replaceScript(script, 1);
    project.production.deletePanel(panel.id);
  });
  expect(project.scriptEntries().every((entry) => entry.panelIds.length === 0)).toBe(true);
  expect(project.toJSON().panels).toHaveLength(1);
});
