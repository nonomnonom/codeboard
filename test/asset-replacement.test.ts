import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { StoryboardProject, ProjectStore, createToneWav } from "../src/index.js";

const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
async function fixture(directory: string) {
  const before = createToneWav({ frequency: 220, durationSeconds: 0.1 });
  const after = createToneWav({ frequency: 880, durationSeconds: 0.1 });
  await writeFile(join(directory, "before.wav"), before);
  const project = StoryboardProject.create({ title: "Replace media" });
  project.production.addAsset({
    id: "asset:tone",
    kind: "audio",
    source: "managed",
    mimeType: "audio/wav",
    name: "Tone",
    path: "before.wav",
  });
  const file = join(directory, "source.cboard");
  await project.save(file);
  return { project, file, before, after };
}

it("does not inherit another project's media when overwriting matching asset IDs and paths", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-media-overwrite-"));
  try {
    const { project, file, before } = await fixture(directory);
    await rm(join(directory, "before.wav"));
    const replacement = StoryboardProject.create({ title: "Different project" });
    replacement.production.addAsset(project.toJSON().assets[0]!);
    await expect(replacement.save(file, { overwrite: true })).rejects.toMatchObject({
      code: "ASSET_MISSING",
    });
    const reopened = await StoryboardProject.open(file);
    expect(reopened.id).toBe(project.id);
    expect(reopened.readAsset("asset:tone")).toEqual(before);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("rejects a missing replacement without committing document or receipt, then retries the same plan", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-media-replace-"));
  try {
    const { project, file, before, after } = await fixture(directory);
    const baseline = project.toJSON();
    const plan = project.plan("Replace tone", [
      {
        op: "asset.update",
        id: "asset:tone",
        changes: { path: "after.wav", checksum: hash(after) },
      },
    ]);
    await expect(project.commit(plan, { requestId: "replace:tone" })).rejects.toMatchObject({
      code: "ASSET_MISSING",
    });
    expect(project.toJSON()).toEqual(baseline);
    const saved = await StoryboardProject.open(file);
    expect(saved.toJSON()).toEqual(baseline);
    expect(saved.readAsset("asset:tone")).toEqual(before);
    using store = ProjectStore.open(file);
    expect(store.readReceipt("replace:tone")).toBeNull();
    await writeFile(join(directory, "after.wav"), after);
    const committed = await project.commit(plan, { requestId: "replace:tone" });
    expect(committed.replayed).toBe(false);
    const reopened = await StoryboardProject.open(file);
    expect(reopened.readAsset("asset:tone")).toEqual(after);
    expect((await reopened.commit(plan, { requestId: "replace:tone" })).replayed).toBe(true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("Save As copies unchanged embedded media but resolves changed declarations instead of copying stale bytes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-media-copy-"));
  try {
    const { project, file, before, after } = await fixture(directory);
    await rm(join(directory, "before.wav"));
    const copied = join(directory, "copy.cboard");
    await project.save(copied);
    expect(project.readAsset("asset:tone")).toEqual(before);
    project.production.updateAsset("asset:tone", { path: "after.wav" });
    await expect(project.save(copied)).rejects.toMatchObject({ code: "ASSET_MISSING" });
    const destination = join(directory, "replacement.cboard");
    await expect(project.save(destination)).rejects.toMatchObject({ code: "ASSET_MISSING" });
    expect((await StoryboardProject.open(file)).readAsset("asset:tone")).toEqual(before);
    expect((await StoryboardProject.open(copied)).readAsset("asset:tone")).toEqual(before);
    await writeFile(join(directory, "after.wav"), after);
    await project.save(destination);
    expect((await StoryboardProject.open(destination)).readAsset("asset:tone")).toEqual(after);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("an explicit assetRoot reloads sources and rejects missing or mismatched replacement bytes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-media-root-"));
  try {
    const { project, file, before, after } = await fixture(directory);
    const assetRoot = join(directory, "replacement");
    await mkdir(assetRoot);
    await expect(project.save(file, { assetRoot })).rejects.toMatchObject({
      code: "ASSET_MISSING",
    });
    expect((await StoryboardProject.open(file)).readAsset("asset:tone")).toEqual(before);
    project.production.updateAsset("asset:tone", { checksum: hash(after) });
    await writeFile(join(assetRoot, "before.wav"), before);
    await expect(project.save(file, { assetRoot })).rejects.toMatchObject({
      code: "ASSET_CHECKSUM_MISMATCH",
    });
    expect((await StoryboardProject.open(file)).readAsset("asset:tone")).toEqual(before);
    await writeFile(join(assetRoot, "before.wav"), after);
    await project.save(file, { assetRoot });
    expect((await StoryboardProject.open(file)).readAsset("asset:tone")).toEqual(after);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
