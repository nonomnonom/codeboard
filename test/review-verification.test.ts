import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  StoryboardProject,
  ProjectStore,
  exportReview,
  verifyReviewExport,
  createReviewDecision,
  verifyReviewDecision,
  readReviewDecision,
} from "../src/index.js";

const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-review-"));
  folders.push(directory);
  const file = join(directory, "project.cboard");
  const project = StoryboardProject.create({ title: "Review", width: 16, height: 16 });
  project.addScene("Scene").addShot("Shot").addPanel({ durationFrames: 4 });
  await project.save(file);
  const store = ProjectStore.open(file);
  try {
    store.saveRevision("reviewed", { expectedVersion: project.version });
  } finally {
    store.close();
  }
  const review = await exportReview(file, directory, {
    expectedVersion: project.version,
    frames: [0, 3],
  });
  const decision = await createReviewDecision(review.directory, {
    id: "decision:1",
    reviewer: { id: "test:reviewer", kind: "agent" },
    outcome: "not-reviewed",
    frames: [],
    criteria: ["Technical verification only"],
    notes: "",
  });
  return { directory, file, project, review, decision };
}

it("binds persisted decisions to exact packages and saved revisions without changing the source", async () => {
  const { file, project, review, decision } = await fixture();
  const before = await readFile(file);
  const result = await verifyReviewDecision(
    review.directory,
    JSON.parse(JSON.stringify(decision)),
    {
      decode: true,
      source: { projectPath: file },
    },
  );
  expect(result.verification.decoded).toBe(2);
  expect(result.source?.version).toBe(project.version);
  expect(await readFile(file)).toEqual(before);
  project.configure({ title: "Revised" });
  await project.save(file);
  await expect(
    verifyReviewDecision(review.directory, decision, { source: { projectPath: file } }),
  ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  expect(
    (
      await verifyReviewDecision(review.directory, decision, {
        source: { projectPath: file, revision: "reviewed" },
      })
    ).source?.version,
  ).toBe(decision.evidence.version);
});

it("rejects decision tampering, unexported frames and different manifest bytes", async () => {
  const { review, decision } = await fixture();
  expect(() => readReviewDecision({ ...decision, notes: "changed" })).toThrow();
  await expect(
    createReviewDecision(review.directory, {
      id: "invalid",
      reviewer: decision.reviewer,
      outcome: "approved",
      frames: [2],
      criteria: decision.criteria,
      notes: "",
    }),
  ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  const manifest = join(review.directory, "manifest.json");
  await writeFile(manifest, `${await readFile(manifest, "utf8")}\n`);
  expect((await verifyReviewExport(review.directory)).verified).toBe(2);
  await expect(verifyReviewDecision(review.directory, decision)).rejects.toMatchObject({
    code: "ASSET_CHECKSUM_MISMATCH",
  });
});

it("rejects corrupted images and traversal manifests without mutating the saved project", async () => {
  const { review, file } = await fixture();
  const before = await readFile(file);
  const image = join(review.directory, review.manifest.frames[0]!.file);
  const bytes = await readFile(image);
  bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1;
  await writeFile(image, bytes);
  await expect(verifyReviewExport(review.directory)).rejects.toMatchObject({
    code: "ASSET_CHECKSUM_MISMATCH",
  });
  const manifest = structuredClone(review.manifest);
  manifest.frames[0]!.file = "../project.cboard";
  await writeFile(join(review.directory, "manifest.json"), JSON.stringify(manifest));
  await expect(verifyReviewExport(review.directory)).rejects.toThrow();
  expect(await readFile(file)).toEqual(before);
});

it("honors cancellation and verifies decision/source binding through the built CLI entry", async () => {
  const { directory, review, decision, file } = await fixture();
  const controller = new AbortController();
  controller.abort();
  await expect(
    verifyReviewExport(review.directory, { signal: controller.signal }),
  ).rejects.toThrow();
  const decisionPath = join(directory, "decision.json");
  await writeFile(decisionPath, JSON.stringify(decision));
  const run = (...args: string[]) =>
    spawnSync(
      process.execPath,
      [resolve("dist/src/cli.js"), "review-verify", review.directory, ...args],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 20000,
      },
    );
  const checked = run("--decode", "--decision", decisionPath, "--source", file);
  expect(checked.status).toBe(0);
  expect(JSON.parse(checked.stdout)).toMatchObject({
    verified: 2,
    decoded: 2,
    sourceChecked: true,
  });
  const invalid = run("--source", file);
  expect(invalid.status).toBe(1);
  expect(JSON.parse(invalid.stderr.trim().split("\n").at(-1)!)).toMatchObject({
    error: { code: "INVALID_ARGUMENT" },
  });
});
