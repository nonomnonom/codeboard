import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  StoryboardProject,
  ProjectStore,
  renderFramePNG,
  renderShotFramePNG,
  createShotRenderSession,
  defineEditorialSequence,
  resolveEditorialFrame,
  reviseEditorialSequence,
  exportReview,
} from "../src/index.js";

const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
});

function fixture() {
  const project = StoryboardProject.create({
    title: "Studio regression",
    width: 64,
    height: 64,
    frameRate: 24,
  });
  const scene = project.addScene("Scene");
  const a = scene.addShot("A").addPanel({ durationFrames: 48 });
  const b = scene.addShot("B").addPanel({ durationFrames: 48 });
  for (const [panel, start, color] of [
    [a, 0, "red"],
    [b, 48, "blue"],
  ] as const) {
    const ink = panel.addVectorLayer("Ink");
    ink.path(
      [{ op: "M", x: 4, y: 4 }, { op: "L", x: 16, y: 4 }, { op: "L", x: 16, y: 16 }, { op: "Z" }],
      { fill: color },
    );
    project.production.addLayerKeyframe(ink.id, start, { transform: { x: 0 } });
    project.production.addLayerKeyframe(ink.id, start + 47, { transform: { x: 32 } });
  }
  const board = project.toJSON();
  project.capturePanelAnimation(a.id, { id: "anim-a" });
  project.capturePanelAnimation(b.id, { id: "anim-b" });
  const animations = project.studio.animations;
  const sequence = defineEditorialSequence(
    {
      id: "edit",
      frameRate: { numerator: 24, denominator: 1 },
      clips: [
        {
          id: "a",
          animationId: "anim-a",
          startFrame: 0,
          sourceInFrame: 0,
          durationFrames: 48,
          transition: { type: "cut", durationFrames: 0 },
        },
        {
          id: "b",
          animationId: "anim-b",
          startFrame: 48,
          sourceInFrame: 0,
          durationFrames: 48,
          transition: { type: "cut", durationFrames: 0 },
        },
      ],
    },
    animations,
  );
  project.putEditorialSequence(sequence);
  return { project, board, animations, sequence };
}

async function savedFixture() {
  const value = fixture();
  const dir = await mkdtemp(join(tmpdir(), "codeboard-studio-"));
  folders.push(dir);
  const file = join(dir, "project.cboard");
  await value.project.save(file);
  return { ...value, dir, file };
}

it("captures global keys into local time without changing board artwork or pixels", async () => {
  const { project, board } = fixture();
  expect(project.toJSON().panels).toEqual(board.panels);
  for (const frame of [0, 12, 47]) {
    expect(await renderShotFramePNG(project.shotAnimation("anim-b"), frame)).toEqual(
      await renderFramePNG(board, 48 + frame),
    );
  }
});

it("moves and trims editorial clips without changing source animation or independent renders", async () => {
  const { project, animations } = fixture();
  const png = await renderShotFramePNG(project.shotAnimation("anim-b"), 12);
  project.editEditorial("edit", [
    { op: "move", id: "b", beforeId: "a" },
    { op: "update", id: "b", changes: { sourceInFrame: 12, durationFrames: 24 } },
  ]);
  expect(project.studio.animations).toEqual(animations);
  expect(await renderShotFramePNG(project.shotAnimation("anim-b"), 12)).toEqual(png);
  expect(
    resolveEditorialFrame(project.editorialSequence("edit"), animations, 0).outgoing,
  ).toMatchObject({ animationId: "anim-b", sourceFrame: 12 });
});

it("rejects a late invalid editorial edit without committing earlier edits", () => {
  const { project } = fixture();
  const before = project.toJSON();
  expect(() =>
    project.editEditorial("edit", [
      { op: "move", id: "b", beforeId: "a" },
      { op: "update", id: "a", changes: { sourceInFrame: 47, durationFrames: 48 } },
    ]),
  ).toThrow();
  expect(project.toJSON()).toEqual(before);
});

it("preserves every source mapping when splitting at an integral mixed-rate boundary", () => {
  const { animations, sequence } = fixture();
  sequence.frameRate = { numerator: 30, denominator: 1 };
  const validated = defineEditorialSequence(sequence, animations);
  const before = structuredClone(validated);
  const split = reviseEditorialSequence(validated, animations, [
    { op: "split", id: "a", atFrame: 15, newId: "a-right" },
  ]);
  for (let frame = 0; frame < 96; frame++) {
    const original = resolveEditorialFrame(validated, animations, frame).outgoing;
    const revised = resolveEditorialFrame(split, animations, frame).outgoing;
    expect([revised.animationId, revised.sourceFrame]).toEqual([
      original.animationId,
      original.sourceFrame,
    ]);
  }
  expect(() =>
    reviseEditorialSequence(validated, animations, [
      { op: "split", id: "a", atFrame: 1, newId: "fractional" },
    ]),
  ).toThrow();
  expect(validated).toEqual(before);
});

it("isolates session input and renders backward seeks consistently", async () => {
  const { project } = fixture();
  const animation = project.shotAnimation("anim-a");
  const session = createShotRenderSession(animation);
  const reference = await session.png(3);
  animation.layers.length = 0;
  await session.png(40);
  expect(await session.png(3)).toEqual(reference);
});

it("retains populated studio data across reopen, checkpoint and compaction", async () => {
  const { project, file } = await savedFixture();
  expect((await StoryboardProject.open(file)).studio).toEqual(project.studio);
  const store = ProjectStore.open(file);
  try {
    store.saveRevision("studio-base", { expectedVersion: project.version });
    store.compact();
    store.verify();
    expect(store.readRevision("studio-base").studio).toEqual(project.studio);
  } finally {
    store.close();
  }
  expect((await StoryboardProject.open(file)).studio).toEqual(project.studio);
});

it("exports saved editorial evidence with matching hashes without changing source bytes", async () => {
  const { project, file, dir } = await savedFixture();
  const bytes = await readFile(file);
  const result = await exportReview(file, dir, {
    expectedVersion: project.version,
    target: { kind: "editorial", sequenceId: "edit" },
    frames: [0, 47, 48, 95],
  });
  for (const entry of result.manifest.frames) {
    expect(
      createHash("sha256")
        .update(await readFile(join(result.directory, entry.file)))
        .digest("hex"),
    ).toBe(entry.sha256);
  }
  expect(await readFile(file)).toEqual(bytes);
});

it("rejects stale and cancelled review exports without publishing partial evidence", async () => {
  const { project, file, dir } = await savedFixture();
  const bytes = await readFile(file);
  const before = await readdir(dir);
  const options = { expectedVersion: project.version, frames: [0] };
  await expect(
    exportReview(file, dir, { ...options, expectedVersion: project.version + 1 }),
  ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  const controller = new AbortController();
  controller.abort();
  await expect(
    exportReview(file, dir, { ...options, signal: controller.signal }),
  ).rejects.toMatchObject({ code: "CANCELLED" });
  expect(await readdir(dir)).toEqual(before);
  expect(await readFile(file)).toEqual(bytes);
});
