import { expect, it } from "vitest";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { StoryboardProject, ProjectStore } from "../../../../src/index.js";
import { fixture } from "./fixture.js";

it("replays after restart and later edits without reverting or discarding local work", async () => {
  const { project, path } = await fixture();
  const plan = project.plan("Title", [{ op: "project.configure", changes: { title: "First" } }]);
  const first = await project.commit(plan, { requestId: "request-1" });
  project.configure({ title: "Later" });
  await project.save(path);
  const reopened = await StoryboardProject.open(path);
  reopened.setMetadata("unsaved", "keep");
  const before = reopened.toJSON();
  expect(await reopened.commit(plan, { requestId: "request-1" })).toEqual({
    ...first,
    replayed: true,
  });
  expect(reopened.toJSON()).toEqual(before);
  const another = reopened.plan("Other", [
    { op: "project.configure", changes: { title: "Other" } },
  ]);
  await expect(reopened.commit(another, { requestId: "request-1" })).rejects.toMatchObject({
    code: "REQUEST_ID_REUSED",
  });
  expect((await StoryboardProject.open(path)).title).toBe("Later");
});

it("rejects stale writers, unsaved changes and equal-version divergent project copies", async () => {
  const { project, path, dir } = await fixture();
  const other = await StoryboardProject.open(path);
  const plan = project.plan("A", [{ op: "project.configure", changes: { title: "A" } }]);
  const stale = other.plan("B", [{ op: "project.configure", changes: { title: "B" } }]);
  const copy = project.toJSON();
  copy.title = "Diverged";
  const copyPath = join(dir, "copy.cboard"),
    diverged = StoryboardProject.fromJSON(copy);
  await diverged.save(copyPath);
  await expect(diverged.commit(plan, { requestId: "copy" })).rejects.toMatchObject({
    code: "REVISION_CONFLICT",
  });
  await project.commit(plan, { requestId: "A" });
  const before = other.toJSON();
  await expect(other.commit(stale, { requestId: "B" })).rejects.toMatchObject({
    code: "REVISION_CONFLICT",
  });
  expect(other.toJSON()).toEqual(before);
  other.setMetadata("unsaved", "value");
  const unsaved = other.plan("Unsaved", [
    { op: "project.configure", changes: { title: "Unsafe" } },
  ]);
  await expect(other.commit(unsaved, { requestId: "unsaved" })).rejects.toMatchObject({
    code: "REVISION_CONFLICT",
  });
  using store = ProjectStore.open(path);
  expect(store.readReceipt("B")).toBeNull();
});

it("uses authoring locks and rejects actor substitution", async () => {
  const { project, path, panel } = await fixture();
  const plan = project.plan("Caption", [
    { op: "panel.revise", id: panel.id, changes: { dialogue: "Edit" } },
  ]);
  const actor = await StoryboardProject.open(path, { actor: "agent:other" });
  await expect(actor.commit(plan, { requestId: "actor" })).rejects.toMatchObject({
    code: "INVALID_ARGUMENT",
  });
  project.production.lock("panel", panel.id, "Review");
  await project.save(path);
  const locked = await StoryboardProject.open(path, { actor: "agent:other" });
  expect(() =>
    locked.plan("Blocked", [{ op: "panel.revise", id: panel.id, changes: { dialogue: "Edit" } }]),
  ).toThrow(/Locked/);
});

it("rolls back artwork if receipt persistence fails, then permits the same request to succeed", async () => {
  const { project, path } = await fixture(),
    before = project.toJSON();
  const plan = project.plan("Atomic", [{ op: "project.configure", changes: { title: "Atomic" } }]);
  const db = new DatabaseSync(path);
  db.exec(
    "CREATE TRIGGER fail_receipt BEFORE INSERT ON roots WHEN NEW.key LIKE 'request:%' BEGIN SELECT RAISE(ABORT,'injected receipt failure'); END",
  );
  try {
    await expect(project.commit(plan, { requestId: "atomic" })).rejects.toThrow(
      /injected receipt failure/,
    );
  } finally {
    db.exec("DROP TRIGGER fail_receipt");
    db.close();
  }
  expect(project.toJSON()).toEqual(before);
  using store = ProjectStore.open(path);
  expect(store.readDocument()).toEqual(before);
  expect(store.readReceipt("atomic")).toBeNull();
  store.verify();
  expect((await project.commit(plan, { requestId: "atomic" })).replayed).toBe(false);
});

it("keeps receipts through named revision restore and compaction", async () => {
  const { project, path } = await fixture();
  using store = ProjectStore.open(path);
  store.saveRevision("before", { expectedVersion: project.version });
  const plan = project.plan("Persist", [
    { op: "project.configure", changes: { title: "Committed" } },
  ]);
  const first = await project.commit(plan, { requestId: "persist" });
  store.restoreRevision("before", { expectedVersion: project.version });
  store.compact();
  store.verify();
  expect(store.readReceipt("persist")).toEqual(first.receipt);
  const restored = await StoryboardProject.open(path);
  expect((await restored.commit(plan, { requestId: "persist" })).replayed).toBe(true);
  expect(restored.title).toBe("Plan");
});
