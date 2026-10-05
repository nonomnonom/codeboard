import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  StoryboardProject,
  ProjectStore,
  migrateProject,
  renderFramePNG,
  renderShotFramePNG,
  renderEditorialFramePNG,
} from "../src/index.js";

const fixtures = resolve("test/fixtures/schema3");
const folders: string[] = [];
afterEach(async () => {
  jest.restoreAllMocks();
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
});

it("removes a reserved destination after a save failure and preserves the legacy source", async () => {
  const { source, target, directory } = await fixture();
  const before = await readFile(source);
  const failure = new Error("Injected destination save failure");
  const save = jest
    .spyOn(StoryboardProject.prototype, "save")
    .mockImplementationOnce(async (path) => {
      expect(path).toBe(target);
      expect(await readFile(target)).toHaveLength(0);
      throw failure;
    });
  await expect(migrateProject(source, target)).rejects.toBe(failure);
  expect(save).toHaveBeenCalledTimes(1);
  expect(await readdir(directory)).toEqual(["legacy.cboard"]);
  expect(await readFile(source)).toEqual(before);
  save.mockRestore();
  await expect(migrateProject(source, target)).resolves.toMatchObject({ targetSchemaVersion: 5 });
});
async function fixture(sourceFixtures = fixtures) {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-migration-"));
  folders.push(directory);
  const source = join(directory, "legacy.cboard");
  await copyFile(join(sourceFixtures, "legacy.cboard"), source);
  return { directory, source, target: join(directory, "migrated.cboard") };
}
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

it("migrates an authentic schema-3 container with board, media and legacy-render parity", async () => {
  const { source, target } = await fixture();
  const expected = JSON.parse(await readFile(join(fixtures, "expected.json"), "utf8"));
  const bytes = await readFile(source);
  expect(hash(bytes)).toBe(expected.fileSha256);
  const report = await migrateProject(source, target);
  expect(report.targetSchemaVersion).toBe(5);
  expect(report.warnings).toEqual(
    expect.arrayContaining([
      expect.stringContaining("does not automatically convert"),
      expect.stringContaining("checkpoints and request receipts remain"),
    ]),
  );
  const migrated = await StoryboardProject.open(target);
  const { schemaVersion, studio, ...document } = migrated.toJSON();
  const { schemaVersion: legacyVersion, ...legacy } = expected.document;
  expect(legacyVersion).toBe(3);
  expect(schemaVersion).toBe(5);
  expect(studio).toEqual({ animations: [], editorial: [] });
  expect(document).toEqual(legacy);
  for (const entry of expected.frames) {
    const png = await renderFramePNG(migrated.toJSON(), entry.frame);
    expect(png).toEqual(await readFile(join(fixtures, `frame-${entry.frame}.png`)));
    expect(hash(png)).toBe(entry.sha256);
  }
  const original = ProjectStore.open(source);
  const destination = ProjectStore.open(target);
  try {
    expect(original.listRevisions().map((item) => item.name)).toEqual(["legacy-checkpoint"]);
    expect(destination.listRevisions()).toEqual([]);
    expect(hash(destination.readAsset(expected.assetId))).toBe(expected.audioSha256);
    expect(destination.readAsset(expected.assetId)).toEqual(original.readAsset(expected.assetId));
    destination.verify();
  } finally {
    original.close();
    destination.close();
  }
  expect(await readFile(source)).toEqual(bytes);
});

it("keeps legacy containers read-only and refuses overwriting source or an existing destination", async () => {
  const { source, target } = await fixture();
  const bytes = await readFile(source);
  const project = await StoryboardProject.open(source);
  await expect(project.save(source)).rejects.toMatchObject({ code: "SCHEMA_MIGRATION_REQUIRED" });
  await expect(migrateProject(source, source)).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  await writeFile(target, "existing destination");
  await expect(migrateProject(source, target)).rejects.toMatchObject({ code: "EEXIST" });
  expect(await readFile(target, "utf8")).toBe("existing destination");
  expect(await readFile(source)).toEqual(bytes);
});

it("does not publish a destination for corrupt input", async () => {
  const { source, target, directory } = await fixture();
  await writeFile(source, "not a project");
  await expect(migrateProject(source, target)).rejects.toThrow();
  expect(await readdir(directory)).toEqual(["legacy.cboard"]);
});

it("migrates an original schema-4 studio container while preserving local renders, audio and source history", async () => {
  const sourceFixtures = resolve("test/fixtures/schema4");
  const { source, target, directory } = await fixture(sourceFixtures);
  const expected = JSON.parse(await readFile(join(sourceFixtures, "expected.json"), "utf8"));
  const sourceBytes = await readFile(source);
  expect(hash(sourceBytes)).toBe(expected.fileSha256);
  const originalProject = await StoryboardProject.open(source);
  await expect(originalProject.save(source)).rejects.toMatchObject({
    code: "SCHEMA_MIGRATION_REQUIRED",
  });
  await expect(
    migrateProject(source, target, { expectedVersion: originalProject.version + 1 }),
  ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  expect(await readdir(directory)).toEqual(["legacy.cboard"]);

  const report = await migrateProject(source, target, { expectedVersion: originalProject.version });
  expect(report).toMatchObject({ sourceContainerVersion: 2, targetSchemaVersion: 5 });
  const migrated = await StoryboardProject.open(target);
  const { schemaVersion, ...document } = migrated.toJSON();
  const { schemaVersion: sourceSchema, ...sourceDocument } = expected.document;
  expect(sourceSchema).toBe(4);
  expect(schemaVersion).toBe(5);
  expect(document).toEqual(sourceDocument);
  expect(document.studio.animations).toHaveLength(2);
  expect(document.studio.animations[0]!.audio![0]!.clips[0]!.source).toEqual({
    sampleRate: 48000,
    startSample: 1001,
    sampleCount: 24000,
  });
  for (const sample of expected.samples) {
    const png =
      sample.kind === "board"
        ? await renderFramePNG(migrated, sample.frame)
        : sample.kind === "shot"
          ? await renderShotFramePNG(document.studio.animations[0]!, sample.frame)
          : await renderEditorialFramePNG(
              document.studio.editorial[0]!,
              document.studio.animations,
              sample.frame,
            );
    expect(png).toEqual(await readFile(join(sourceFixtures, sample.filename)));
    expect(hash(png)).toBe(sample.sha256);
  }
  const original = ProjectStore.open(source);
  const destination = ProjectStore.open(target);
  try {
    expect(original.inspect()).toMatchObject({ formatVersion: 2, writable: false });
    expect(destination.inspect()).toMatchObject({ formatVersion: 3, writable: true });
    expect(original.listRevisions().map((revision) => revision.name)).toEqual([
      "studio-checkpoint",
    ]);
    expect(original.readReceipt("legacy-request")).toEqual(expected.receipt);
    expect(destination.listRevisions()).toEqual([]);
    expect(destination.readReceipt("legacy-request")).toBeNull();
    expect(hash(destination.readAsset("cue"))).toBe(expected.audioSha256);
    expect(destination.readAsset("cue")).toEqual(original.readAsset("cue"));
    original.verify();
    destination.verify();
  } finally {
    original.close();
    destination.close();
  }
  const beforeStudio = migrated.studio;
  const committed = await migrated.commit(
    migrated.plan("Revise migrated project", [
      { op: "project.metadata", key: "migration", value: "verified" },
    ]),
    { requestId: "migrated-request" },
  );
  expect(committed.replayed).toBe(false);
  expect((await StoryboardProject.open(target)).studio).toEqual(beforeStudio);
  expect(await readFile(source)).toEqual(sourceBytes);
});
