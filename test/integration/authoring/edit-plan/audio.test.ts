import { expect, it } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { StoryboardProject, ProjectStore, createToneWav } from "../../../../src/index.js";
import { fixture } from "./fixture.js";

it("pins imported media bytes and rolls back both clip edits and receipts on missing or changed sources", async () => {
  const { project, path, dir } = await fixture(),
    before = project.toJSON();
  const bytes = createToneWav({ frequency: 220 }),
    changed = createToneWav({ frequency: 440 });
  const checksum = (value: Buffer) => createHash("sha256").update(value).digest("hex");
  const source = join(dir, "voice.wav"),
    asset = {
      id: "asset:voice",
      kind: "audio" as const,
      name: "Voice",
      path: "voice.wav",
      mimeType: "audio/wav",
      source: "managed" as const,
      checksum: checksum(bytes),
    };
  const plan = project.plan("Import voice and place clip", [
    { op: "asset.add", asset },
    { op: "audio.track.add", id: "track:voice", name: "Voice" },
    {
      op: "audio.clip.add",
      trackId: "track:voice",
      clip: {
        id: "clip:voice",
        assetId: asset.id,
        name: "Voice",
        startFrame: 0,
        sourceInFrame: 0,
        durationFrames: 24,
        volume: 1,
        fadeInFrames: 0,
        fadeOutFrames: 0,
      },
    },
  ]);
  await expect(project.commit(plan, { requestId: "import" })).rejects.toMatchObject({
    code: "ASSET_MISSING",
  });
  expect(project.toJSON()).toEqual(before);
  await writeFile(source, changed);
  await expect(project.commit(plan, { requestId: "import" })).rejects.toMatchObject({
    code: "ASSET_CHECKSUM_MISMATCH",
    details: { assetId: asset.id },
  });
  using store = ProjectStore.open(path);
  expect(store.readDocument()).toEqual(before);
  expect(store.readReceipt("import")).toBeNull();
  store.verify();
  await writeFile(source, bytes);
  await project.commit(JSON.parse(JSON.stringify(plan)), { requestId: "import" });
  expect(project.readAsset(asset.id)).toEqual(bytes);
  await writeFile(source, changed);
  expect((await project.commit(plan, { requestId: "import" })).replayed).toBe(true);
  expect(project.readAsset(asset.id)).toEqual(bytes);
  const replace = project.plan("Replace voice", [
    { op: "asset.update", id: asset.id, changes: { checksum: checksum(changed) } },
  ]);
  await project.commit(replace, { requestId: "replace-voice" });
  expect((await StoryboardProject.open(path)).readAsset(asset.id)).toEqual(changed);
  expect(project.production.audioClip("clip:voice").assetId).toBe(asset.id);
  expect(() =>
    project.plan("Unpinned", [
      { op: "asset.add", asset: { ...asset, checksum: undefined } as never },
    ]),
  ).toThrow();
  store.verify();
});

it("edits audio tracks and clips atomically while retaining source bytes, offsets and fades", async () => {
  const { project, path, dir } = await fixture();
  const wav = createToneWav();
  await writeFile(join(dir, "tone.wav"), wav);
  const assetId = project.production.addAsset({
    kind: "audio",
    name: "Tone",
    path: "tone.wav",
    mimeType: "audio/wav",
    source: "managed",
  });
  await project.save(path);
  const before = project.toJSON();
  const plan = project.plan("Audio edit", [
    { op: "audio.track.add", id: "track:dialogue", name: "Dialogue" },
    { op: "audio.track.add", id: "track:alt", name: "Alternate" },
    {
      op: "audio.clip.add",
      trackId: "track:dialogue",
      clip: {
        id: "clip:line",
        assetId,
        name: "Line",
        startFrame: 0,
        sourceInFrame: 3,
        durationFrames: 20,
        volume: 1,
        fadeInFrames: 2,
        fadeOutFrames: 2,
      },
    },
    {
      op: "audio.clip.update",
      trackId: "track:dialogue",
      id: "clip:line",
      changes: { volume: 0.7, name: "Edited line" },
    },
    { op: "audio.clip.move", id: "clip:line", trackId: "track:alt", startFrame: 2 },
    { op: "audio.clip.split", id: "clip:line", frame: 12 },
    {
      op: "audio.track.update",
      id: "track:alt",
      changes: { name: "Selected dialogue", muted: false },
    },
    { op: "audio.track.remove", id: "track:dialogue" },
  ]);
  expect(project.toJSON()).toEqual(before);
  await project.commit(JSON.parse(JSON.stringify(plan)), { requestId: "audio" });
  const reopened = await StoryboardProject.open(path),
    clips = reopened.production.audioClips("track:alt");
  expect(clips).toHaveLength(2);
  expect(clips[0]).toMatchObject({
    id: "clip:line",
    startFrame: 2,
    sourceInFrame: 3,
    durationFrames: 10,
    fadeInFrames: 2,
    fadeOutFrames: 0,
    volume: 0.7,
  });
  expect(clips[1]).toMatchObject({
    startFrame: 12,
    sourceInFrame: 13,
    durationFrames: 10,
    fadeInFrames: 0,
    fadeOutFrames: 2,
    volume: 0.7,
  });
  expect(reopened.readAsset(assetId)).toEqual(wav);
  expect((await reopened.commit(plan, { requestId: "audio" })).replayed).toBe(true);
  expect(reopened.production.audioClips("track:alt")).toEqual(clips);
  const current = reopened.toJSON();
  expect(() =>
    reopened.plan("Bad split", [
      { op: "audio.track.update", id: "track:alt", changes: { name: "discard" } },
      { op: "audio.clip.split", id: "clip:line", frame: 3 },
    ]),
  ).toThrow(/fade/);
  expect(() =>
    reopened.plan("Bad asset", [
      {
        op: "audio.clip.add",
        trackId: "track:alt",
        clip: { ...clips[0]!, id: "clip:bad", assetId: "missing" },
      },
    ]),
  ).toThrow(/asset/);
  expect(reopened.toJSON()).toEqual(current);
  await reopened.commit(
    reopened.plan("Lock track", [
      { op: "audio.track.update", id: "track:alt", changes: { locked: true } },
    ]),
    { requestId: "lock-audio" },
  );
  expect(() =>
    reopened.plan("Locked clip", [
      { op: "audio.clip.remove", trackId: "track:alt", id: clips[1]!.id },
    ]),
  ).toThrow(/locked/);
  await reopened.commit(
    reopened.plan("Remove alternate", [
      { op: "audio.track.update", id: "track:alt", changes: { locked: false } },
      { op: "audio.clip.remove", trackId: "track:alt", id: clips[1]!.id },
    ]),
    { requestId: "remove-audio" },
  );
  expect(reopened.production.audioClips("track:alt")).toEqual([clips[0]]);
});
