import { mkdtemp, rm, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  StoryboardProject,
  ProjectStore,
  publishProject,
  verifyProjectPublish,
  renderShotFramePNG,
  createToneWav,
} from "../src/index.js";

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-publish-"));
  directories.push(directory);
  const project = StoryboardProject.create({ title: "Pinned publish", width: 32, height: 32 });
  const panel = project.addScene("Scene").addShot("Shot").addPanel({ durationFrames: 24 });
  panel.addVectorLayer("Text").text("A", 4, 20, { font: "14px sans-serif", color: "red" });
  project.capturePanelAnimation(panel.id, { id: "animation:shot" });
  const bytes = createToneWav({ durationSeconds: 0.1 });
  const assetPath = join(directory, "media.wav");
  await writeFile(assetPath, bytes);
  const assetId = project.production.addAsset({
    kind: "audio",
    name: "Media",
    path: "media.wav",
    mimeType: "audio/wav",
    source: "managed",
    checksum: createHash("sha256").update(bytes).digest("hex"),
  });
  const source = join(directory, "source.cboard");
  await project.save(source);
  {
    using store = ProjectStore.open(source);
    store.saveRevision("baseline", { expectedVersion: project.version });
  }
  const plan = project.plan("Published caption", [
    { op: "panel.revise", id: panel.id, changes: { notes: "Published" } },
  ]);
  const committed = await project.commit(plan, { requestId: "caption:publish" });
  return { directory, project, source, bytes, assetId, assetPath, committed, panel };
}

it("publishes a verified native snapshot with checkpoints, receipts and embedded media after source loss", async () => {
  const { directory, project, source, assetPath, bytes, assetId, committed } = await fixture();
  const sourceBytes = await readFile(source);
  const published = await publishProject(source, join(directory, "published"), {
    expectedVersion: project.version,
  });
  expect(await readFile(source)).toEqual(sourceBytes);
  expect(published.manifest.externalFonts).toEqual(["14px sans-serif"]);
  await unlink(source);
  await unlink(assetPath);
  const verified = await verifyProjectPublish(published.directory, {
    expectedManifestHash: published.manifestHash,
  });
  expect(verified.runtimeMatches).toBe(true);
  {
    using store = ProjectStore.open(verified.projectFile);
    expect(store.readAsset(assetId)).toEqual(bytes);
    expect(store.readReceipt("caption:publish")).toEqual(committed.receipt);
    expect(store.readRevision("baseline").panels[0]!.notes).toBe("");
  }
  const opened = await StoryboardProject.open(verified.projectFile);
  expect(opened.toJSON()).toEqual(project.toJSON());
  expect(await renderShotFramePNG(opened.shotAnimation("animation:shot"), 0)).toEqual(
    await renderShotFramePNG(project.shotAnimation("animation:shot"), 0),
  );
  const originalHash = published.manifest.file.sha256;
  await opened.save(join(directory, "working.cboard"));
  opened.configure({ title: "Editable resumed copy" });
  await opened.save(join(directory, "working.cboard"));
  expect((await verifyProjectPublish(published.directory)).manifest.file.sha256).toBe(originalHash);
});

it("rejects stale sources, cancellation, budgets and existing destinations without replacing files", async () => {
  const { directory, project, source } = await fixture();
  const root = join(directory, "published");
  await expect(
    publishProject(source, root, { expectedVersion: project.version - 1 }),
  ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  expect(await readdir(root)).toEqual([]);
  await expect(
    publishProject(source, root, { expectedVersion: project.version, maxBytes: 1 }),
  ).rejects.toMatchObject({ code: "RESOURCE_LIMIT" });
  expect(await readdir(root)).toEqual([]);
  const controller = new AbortController();
  controller.abort();
  await expect(
    publishProject(source, root, { expectedVersion: project.version, signal: controller.signal }),
  ).rejects.toMatchObject({ code: "CANCELLED" });
  const destination = join(directory, "existing.cboard");
  const sentinel = Buffer.from("Keep existing content");
  await writeFile(destination, sentinel);
  {
    using store = ProjectStore.open(source);
    await expect(
      store.copyTo(destination, { expectedVersion: project.version }),
    ).rejects.toMatchObject({ code: "EEXIST" });
  }
  expect(await readFile(destination)).toEqual(sentinel);
  expect((await readdir(directory)).filter((name) => name.startsWith(".codeboard-copy-"))).toEqual(
    [],
  );
});

it("detects container and manifest tampering and reports an engine mismatch", async () => {
  const { directory, project, source } = await fixture();
  const published = await publishProject(source, join(directory, "published"), {
    expectedVersion: project.version,
  });
  const original = await readFile(published.projectFile),
    changed = Buffer.from(original);
  changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
  await writeFile(published.projectFile, changed);
  await expect(verifyProjectPublish(published.directory)).rejects.toMatchObject({
    code: "ASSET_CHECKSUM_MISMATCH",
  });
  await writeFile(published.projectFile, original);
  const manifest = structuredClone(published.manifest);
  manifest.engine.version = "different-engine";
  await writeFile(join(published.directory, "manifest.json"), JSON.stringify(manifest));
  await expect(
    verifyProjectPublish(published.directory, { expectedManifestHash: published.manifestHash }),
  ).rejects.toMatchObject({ code: "ASSET_CHECKSUM_MISMATCH" });
  expect((await verifyProjectPublish(published.directory)).runtimeMatches).toBe(false);
  manifest.source.version++;
  await writeFile(join(published.directory, "manifest.json"), JSON.stringify(manifest));
  await expect(verifyProjectPublish(published.directory)).rejects.toMatchObject({
    code: "REVISION_CONFLICT",
  });
  await writeFile(
    join(published.directory, "manifest.json"),
    JSON.stringify({ ...manifest, file: { ...manifest.file, name: "../outside.cboard" } }),
  );
  await expect(verifyProjectPublish(published.directory)).rejects.toMatchObject({
    code: "INVALID_ARGUMENT",
  });
});

it("rejects a changed source during asynchronous copy and cleans cancelled in-progress copies", async () => {
  const { directory, project, source, panel } = await fixture();
  using store = ProjectStore.open(source);
  const target = join(directory, "concurrent.cboard");
  const pending = store.copyTo(target, { expectedVersion: project.version });
  project.panel(panel.id).revise({ notes: "Concurrent source revision" });
  await project.save(source);
  await expect(pending).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  expect(await readdir(directory)).not.toContain("concurrent.cboard");
  const controller = new AbortController();
  const cancelled = store.copyTo(target, {
    expectedVersion: project.version,
    signal: controller.signal,
  });
  controller.abort();
  await expect(cancelled).rejects.toMatchObject({ code: "CANCELLED" });
  expect(
    (await readdir(directory)).filter(
      (name) => name.startsWith(".codeboard-copy-") || name === "concurrent.cboard",
    ),
  ).toEqual([]);
});

it("publishes a legacy archive without making it writable or changing its source", async () => {
  const { directory } = await fixture();
  const legacy = "test/fixtures/schema3/legacy.cboard";
  const original = await readFile(legacy);
  using store = ProjectStore.open(legacy);
  const root = join(directory, "legacy-publish");
  const published = await publishProject(legacy, root, { expectedVersion: store.version });
  await verifyProjectPublish(published.directory, { expectedManifestHash: published.manifestHash });
  using archived = ProjectStore.open(published.projectFile);
  expect(archived.inspect().writable).toBe(false);
  expect(archived.readDocument()).toEqual(store.readDocument());
  expect(() => archived.saveRevision("new", { expectedVersion: archived.version })).toThrow(
    expect.objectContaining({ code: "SCHEMA_MIGRATION_REQUIRED" }),
  );
  expect(await readFile(legacy)).toEqual(original);
});
