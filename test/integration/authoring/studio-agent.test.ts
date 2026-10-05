import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  StoryboardProject,
  ProjectStore,
  defineEditorialSequence,
  createToneWav,
  type ObjectQuery,
} from "../../../src/index.js";
import { PayloadCodec } from "../../../src/storage/codec.js";

const folders: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
});

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "codeboard-studio-agent-"));
  folders.push(dir);
  const project = StoryboardProject.create({ title: "Studio agent", width: 32, height: 32 });
  const panel = project.addScene("Scene").addShot("Shot").addPanel({ durationFrames: 24 });
  panel.addVectorLayer("Ink").path(
    [
      { op: "M", x: 2, y: 2 },
      { op: "L", x: 12, y: 12 },
    ],
    { stroke: "red", strokeWidth: 2 },
  );
  project.capturePanelAnimation(panel.id, { id: "animation" });
  await writeFile(join(dir, "cue.wav"), createToneWav());
  project.production.addAsset({
    id: "cue",
    name: "Cue",
    kind: "audio",
    path: "cue.wav",
    source: "linked",
    mimeType: "audio/wav",
  });
  project.setStudioAudio("animation", [
    {
      id: "track",
      name: "Muted source",
      muted: true,
      clips: [
        {
          id: "audio-clip",
          assetId: "cue",
          name: "Cue",
          start: { ticks: 0, rate: { numerator: 24, denominator: 1 } },
          source: { sampleRate: 48000, startSample: 0, sampleCount: 48000 },
          volume: 1,
          fadeInSamples: 0,
          fadeOutSamples: 0,
        },
      ],
    },
  ]);
  project.putEditorialSequence(
    defineEditorialSequence(
      {
        id: "edit",
        frameRate: { numerator: 24, denominator: 1 },
        clips: Array.from({ length: 205 }, (_, index) => ({
          id: `clip-${index}`,
          animationId: "animation",
          startFrame: index,
          sourceInFrame: 0,
          durationFrames: 1,
          transition: { type: "cut", durationFrames: 0 },
        })),
      },
      project.studio.animations,
    ),
  );
  const file = join(dir, "project.cboard");
  await project.save(file);
  return { dir, project, file, panel };
}

it("bounds detached studio reads and rejects wrong-owner or invalid page requests", async () => {
  const { project } = await fixture();
  const snapshot = vi.spyOn(project, "toJSON").mockImplementation(() => {
    throw new Error("Full snapshot");
  });
  expect(project.editorialClips("edit")).toHaveLength(50);
  expect(project.editorialClips("edit", { limit: 999 })).toHaveLength(200);
  expect(project.editorialClips("edit", { offset: 200 })).toHaveLength(5);
  const clips = project.editorialClips("edit", { limit: 1 });
  clips[0]!.sourceInFrame = 999;
  expect(project.editorialClips("edit", { limit: 1 })[0]!.sourceInFrame).toBe(0);
  expect(project.studioAudioTracks("animation")).toEqual([
    { id: "track", name: "Muted source", muted: true, clipCount: 1 },
  ]);
  const audio = project.studioAudioClips("animation", "track");
  audio[0]!.source.startSample = 99;
  expect(project.studioAudioClips("animation", "track")[0]!.source.startSample).toBe(0);
  expect(() => project.studioAudioClips("edit", "track")).toThrow(
    expect.objectContaining({ code: "INVALID_ARGUMENT" }),
  );
  expect(() => project.editorialClips("edit", { offset: -1 })).toThrow(
    expect.objectContaining({ code: "INVALID_ARGUMENT" }),
  );
  expect(snapshot).not.toHaveBeenCalled();
});

it("matches live, indexed and fallback studio inventory without decoding indexed artwork", async () => {
  const { project, file } = await fixture();
  using store = ProjectStore.open(file);
  const queries: ObjectQuery[] = [
    { kind: "shot-animation" },
    { kind: "editorial-sequence" },
    { kind: "editorial-clip", limit: 200 },
    { kind: "studio-audio-track" },
    { kind: "studio-audio-clip" },
  ];
  // Live discovery uses traversal order; the saved catalog pages in binary ID order.
  const expected = queries.map((query) =>
    [
      ...project.production.find({ ...query, limit: 200 }),
      ...project.production.find({ ...query, limit: 200, offset: 200 }),
    ].sort((a, b) => Buffer.compare(Buffer.from(a.id), Buffer.from(b.id))),
  );
  const summary = project.production.summary();
  const payload = vi.spyOn(PayloadCodec.prototype, "read").mockImplementation(() => {
    throw new Error("Payload decoded");
  });
  for (const [index, query] of queries.entries())
    expect([
      ...store.query({ ...query, limit: 200 }).items,
      ...store.query({ ...query, limit: 200, offset: 200 }).items,
    ]).toEqual(expected[index]);
  expect(store.query({ limit: 1 }).summary).toEqual(summary);
  expect(payload).not.toHaveBeenCalled();
  payload.mockRestore();
  const db = new DatabaseSync(file);
  try {
    db.exec("DROP TABLE object_catalog; DROP TABLE catalog_state");
  } finally {
    db.close();
  }
  for (const [index, query] of queries.entries())
    expect([
      ...store.query({ ...query, limit: 200 }).items,
      ...store.query({ ...query, limit: 200, offset: 200 }).items,
    ]).toEqual(expected[index]);
  expect(store.query({ limit: 1 }).summary).toEqual(summary);
  expect(summary.studio).toEqual({
    animations: 1,
    editorialSequences: 1,
    editorialClips: 205,
    audioTracks: 1,
    audioClips: 1,
  });
});

it("replays studio edits after restart while rejecting request collision and stale writers without partial state", async () => {
  const { project, file } = await fixture();
  const other = await StoryboardProject.open(file);
  const command = {
    op: "editorial.edit" as const,
    id: "edit",
    edits: [{ op: "move" as const, id: "clip-204", beforeId: "clip-0" }],
  };
  const plan = project.plan("Move last cut first", [command]);
  const stale = other.plan("Another writer", [command]);
  const receipt = await project.commit(plan, { requestId: "studio-request" });
  const saved = await readFile(file);
  const reopened = await StoryboardProject.open(file);
  expect(await reopened.commit(plan, { requestId: "studio-request" })).toEqual({
    ...receipt,
    replayed: true,
  });
  const collision = reopened.plan("Remove another cut", [
    { op: "editorial.edit", id: "edit", edits: [{ op: "remove", id: "clip-1" }] },
  ]);
  await expect(reopened.commit(collision, { requestId: "studio-request" })).rejects.toMatchObject({
    code: "REQUEST_ID_REUSED",
  });
  const before = other.toJSON();
  await expect(other.commit(stale, { requestId: "stale-studio" })).rejects.toMatchObject({
    code: "REVISION_CONFLICT",
  });
  expect(other.toJSON()).toEqual(before);
  expect(await readFile(file)).toEqual(saved);
  using store = ProjectStore.open(file);
  expect(store.readReceipt("stale-studio")).toBeNull();
});
