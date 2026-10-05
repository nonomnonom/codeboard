import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { StoryboardProject, ProjectStore, createPixels } from "../../../src/index.js";
import type { ObjectQuery } from "../../../src/index.js";
import { PayloadCodec } from "../../../src/storage/codec.js";

const folders: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const dir of folders.splice(0)) await rm(dir, { recursive: true, force: true });
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "codeboard-query-"));
  folders.push(dir);
  const path = join(dir, "query.cboard"),
    project = StoryboardProject.create({ title: "Query", width: 64, height: 48 });
  const shot = project.addScene("Scene").addShot("Shot"),
    panel = shot.addPanel({ durationFrames: 24 }),
    later = shot.addPanel({ durationFrames: 24 });
  const group = panel.addGroup("ÄCTORS"),
    ink = panel.addRasterLayer("Ink", {}, group.id);
  const element = ink.rasterSurface(createPixels(256, 256), {
    id: "element:pixels",
    name: "ÄCTOR pixels",
  });
  project.production.addLayerKeyframe(ink.id, 0, { opacity: 0.8 });
  project.production.addCameraKeyframe(shot.id, 0, { zoom: 1 });
  project.production.captureComponent(group.id, "Reusable");
  project.production.comment("Fix pixels", { elementId: element });
  project.production.lock("layer", group.id, "Review");
  project.production.addAudioTrack("Dialogue");
  await project.save(path);
  return { path, project, panel, later, group, ink };
}

it("queries all metadata owners without decoding panels/components or taking an authoring snapshot", async () => {
  const { path, project, panel, group } = await fixture();
  using store = ProjectStore.open(path);
  const document = vi.spyOn(store, "readDocument").mockImplementation(() => {
    throw new Error("Full document decoded");
  });
  const artwork = vi.spyOn(store, "readPanel").mockImplementation(() => {
    throw new Error("Panel decoded");
  });
  const header = vi.spyOn(store, "readHeader").mockImplementation(() => {
    throw new Error("Header/brush payload decoded");
  });
  const payload = vi.spyOn(PayloadCodec.prototype, "read").mockImplementation(() => {
    throw new Error("Immutable payload decoded");
  });
  const sort = (items: { id: string }[]) =>
    items.sort((a, b) => Buffer.compare(Buffer.from(a.id), Buffer.from(b.id)));
  const queries: ObjectQuery[] = [
    {},
    { kind: "" },
    { panelId: "" },
    { id: "" },
    { parentId: "" },
    { kind: "shot" },
    { kind: "layer-key" },
    { kind: "camera-key" },
    { kind: "component" },
    { kind: "comment" },
    { kind: "lock" },
    { panelId: panel.id },
    { parentId: group.id },
    { name: "äctor" },
    { id: "element:pixels" },
  ];
  for (const query of queries) {
    const result = store.query({ ...query, limit: 200 });
    expect(result.indexed).toBe(true);
    expect(result.items).toEqual(sort(project.production.find({ ...query, limit: 200 })));
    expect(result.summary).toEqual(project.production.summary());
  }
  const all = store.query({ limit: 200 }).items;
  expect(store.query({ limit: 3, offset: 3 }).items).toEqual(all.slice(3, 6));
  expect(() => store.query({ limit: 1 }, { expectedVersion: project.version - 1 })).toThrow(
    /version changed/,
  );
  expect(() => store.query({ typo: true } as never)).toThrow(/Invalid object query/);
  expect(document).not.toHaveBeenCalled();
  expect(artwork).not.toHaveBeenCalled();
  expect(header).not.toHaveBeenCalled();
  expect(payload).not.toHaveBeenCalled();
});

it("updates the indexed ownership and names during targeted panel edits without reading other panels", async () => {
  const { path, project, panel, later, ink } = await fixture();
  // Unlock the ancestor for this independent partial revision.
  project.production.unlock(project.toJSON().locks[0]!.id);
  await project.save(path);
  using store = ProjectStore.open(path);
  const edited = store.readPanel(panel.id),
    other = store.readPanel(later.id);
  const group = edited.layers[0]!;
  if (group.kind !== "group") throw new Error("fixture");
  group.children[0]!.name = "Renamed ink";
  const reader = store.readPanel.bind(store);
  const spy = vi.spyOn(store, "readPanel").mockImplementation((id, options) => {
    if (id === later.id) throw new Error("Unrelated panel decoded");
    return reader(id, options);
  });
  store.updatePanel(edited, { expectedVersion: project.version });
  expect(store.query({ id: ink.id })).toMatchObject({
    indexed: true,
    items: [{ name: "Renamed ink", panelId: panel.id, parentId: group.id }],
  });
  spy.mockRestore();
  expect(store.readPanel(later.id)).toEqual(other);
  store.verify();
});

it("falls back for legacy/stale catalogs without writes and rebuilds them on the next save", async () => {
  const { path, project } = await fixture();
  using store = ProjectStore.open(path);
  const indexed = store.query({ limit: 200 });
  const db = new DatabaseSync(path);
  try {
    db.exec("DROP TABLE object_catalog; DROP TABLE catalog_state");
    expect(store.query({ limit: 200 })).toEqual({ ...indexed, indexed: false });
    expect(
      db.prepare("SELECT name FROM sqlite_master WHERE name='object_catalog'").get(),
    ).toBeUndefined();
    await project.save(path);
    expect(store.query({ limit: 200 })).toEqual(indexed);
    db.exec("UPDATE catalog_state SET header_hash='stale'; UPDATE object_catalog SET name='wrong'");
    expect(store.query({ limit: 200 })).toEqual({ ...indexed, indexed: false });
    await project.save(path);
    expect(store.query({ limit: 200 })).toEqual(indexed);
    store.verify();
    db.exec("UPDATE object_catalog SET name='wrong' WHERE kind='project'");
    expect(() => store.verify()).toThrow(/catalog differs/);
  } finally {
    db.close();
  }
});

it("keeps catalog and document atomic during plan commits and restores", async () => {
  const { path, project } = await fixture();
  using store = ProjectStore.open(path);
  store.saveRevision("before", { expectedVersion: project.version });
  const initial = store.query({ limit: 200 });
  const plan = project.plan("Rename", [{ op: "project.configure", changes: { title: "After" } }]);
  const db = new DatabaseSync(path);
  try {
    db.exec(
      "CREATE TRIGGER fail_catalog BEFORE INSERT ON object_catalog BEGIN SELECT RAISE(ABORT,'catalog failure'); END",
    );
    await expect(project.commit(plan, { requestId: "catalog" })).rejects.toThrow(/catalog failure/);
    expect(store.query({ limit: 200 })).toEqual(initial);
    expect(store.readReceipt("catalog")).toBeNull();
    db.exec("DROP TRIGGER fail_catalog");
    await project.commit(plan, { requestId: "catalog" });
    expect(store.query({ id: project.id }).items[0]!.name).toBe("After");
    store.restoreRevision("before", { expectedVersion: project.version });
    expect(store.query({ id: project.id })).toMatchObject({
      indexed: true,
      items: [{ name: "Query" }],
    });
    store.compact();
    store.verify();
  } finally {
    db.close();
  }
});

it("bounds the entire response including summary and truncates labels without changing matching", async () => {
  const { path, project } = await fixture();
  project.configure({ title: "A".repeat(600) });
  await project.save(path);
  using store = ProjectStore.open(path);
  expect(store.query({ name: "A".repeat(500) })).toMatchObject({
    summary: { title: "A".repeat(256), titleTruncated: true },
    items: [{ name: "A".repeat(256), nameTruncated: true }],
  });
  const oversized = StoryboardProject.create({ title: "Huge identity", id: "x".repeat(262144) });
  const oversizedPath = join(folders.at(-1)!, "oversized.cboard");
  await oversized.save(oversizedPath);
  using huge = ProjectStore.open(oversizedPath);
  expect(() => huge.query({ kind: "brush", limit: 1 })).toThrow(/Object page exceeds/);
  expect(() => huge.query({ kind: "absent", limit: 1 })).toThrow(/response exceeds/);
});
