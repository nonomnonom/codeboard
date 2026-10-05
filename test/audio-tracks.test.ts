afterEach(() => jest.restoreAllMocks());

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StoryboardProject, createToneWav } from "../src/index.js";

it("moves a stable clip between tracks atomically without changing its source trim or envelope", async () => {
  const p = StoryboardProject.create({ title: "Move cue" });
  const asset = p.production.addAsset({
    name: "Cue",
    kind: "audio",
    path: "cue.wav",
    source: "linked",
    mimeType: "audio/wav",
  });
  const a = p.production.addAudioTrack("Scratch"),
    b = p.production.addAudioTrack("Final effects");
  const id = p.production.addAudioClip(a, {
    assetId: asset,
    name: "Repair",
    startFrame: 10,
    sourceInFrame: 3,
    durationFrames: 12,
    volume: 0.7,
    fadeInFrames: 2,
    fadeOutFrames: 3,
  });
  const initial = p.production.audioClip(id);
  for (const locked of [a, b]) {
    p.production.updateAudioTrack(locked, { locked: true });
    const before = p.toJSON();
    expect(() => p.production.moveAudioClip(id, b)).toThrow(/locked/);
    expect(p.toJSON()).toEqual(before);
    p.production.updateAudioTrack(locked, { locked: false });
  }
  p.transaction("Recover and move", () => {
    for (const action of [
      () => p.production.moveAudioClip(id, "missing"),
      () => p.production.moveAudioClip(id, b, { startFrame: -1 }),
      () => p.production.moveAudioClip(id, b, { expectedVersion: p.version - 1 }),
    ]) {
      const unchanged = p.toJSON();
      expect(action).toThrow();
      expect(p.toJSON()).toEqual(unchanged);
    }
    p.production.moveAudioClip(id, b, { startFrame: 18 });
  });
  expect(p.production.audioClip(id)).toEqual({ ...initial, trackId: b, startFrame: 18 });
  expect(p.production.audioClips(a)).toEqual([]);
  expect(p.production.audioClips(b)).toHaveLength(1);
  p.undo();
  expect(p.production.audioClip(id)).toEqual(initial);
  p.redo();
  p.production.moveAudioClip(id, b, { startFrame: 18 });
  expect(p.production.audioClips(b)).toHaveLength(1);
  const dir = await mkdtemp(join(tmpdir(), "move-audio-"));
  try {
    await writeFile(join(dir, "cue.wav"), createToneWav({ durationSeconds: 1 }));
    const file = join(dir, "move.cboard");
    await p.save(file);
    const opened = await StoryboardProject.open(file);
    expect(opened.production.audioClip(id)).toEqual(p.production.audioClip(id));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it("finds and inspects bounded audio metadata with exact frame boundaries and detached results", () => {
  const p = StoryboardProject.create({ title: "Audio inspection" });
  const asset = p.production.addAsset({
    name: "Cue",
    kind: "audio",
    path: "cue.wav",
    source: "linked",
    mimeType: "audio/wav",
  });
  const track = p.production.addAudioTrack("Mechanism"),
    other = p.production.addAudioTrack("Rain");
  const clips: string[] = [];
  for (let index = 0; index < 4; index++)
    clips.push(
      p.production.addAudioClip(track, {
        assetId: asset,
        name: `Click ${index}`,
        startFrame: index * 4,
        sourceInFrame: index,
        durationFrames: 6,
        volume: 1,
        fadeInFrames: 0,
        fadeOutFrames: 0,
      }),
    );
  p.production.updateAudioTrack(track, { muted: true });
  const before = p.toJSON(),
    spy = jest.spyOn(p, "toJSON").mockImplementation(() => {
      throw new Error("Full snapshot");
    });
  try {
    expect(p.production.audioTracks({ limit: 1, offset: 1 })).toEqual([
      { id: other, name: "Rain", muted: false, locked: false, clipCount: 0 },
    ]);
    const found = p.production.find({ kind: "audio-clip", name: "Click", limit: 1, offset: 1 });
    expect(found).toEqual([{ id: clips[1], kind: "audio-clip", name: "Click 1", parentId: track }]);
    expect(p.production.find({ kind: "audio-track", name: "rain" })[0]!.id).toBe(other);
    expect(p.production.audioClips(track, { frame: 4 }).map((clip) => clip.id)).toEqual(
      clips.slice(0, 2),
    );
    expect(p.production.audioClips(track, { frame: 6 }).map((clip) => clip.id)).toEqual([clips[1]]);
    expect(p.production.audioClips(track, { frame: 18 })).toEqual([]);
    expect(p.production.audioClips(track, { assetId: "missing" })).toEqual([]);
    expect(
      p.production.audioClips(track, { frame: 4, offset: 1, limit: 1 }).map((clip) => clip.id),
    ).toEqual([clips[1]]);
    const clip = p.production.audioClip(clips[2]!);
    expect(clip).toMatchObject({ trackId: track, startFrame: 8, sourceInFrame: 2 });
    clip.volume = 0;
    const summary = p.production.audioTracks()[0]!;
    summary.muted = false;
    p.production.audioClips(track)[0]!.name = "mutated copy";
    expect(p.production.audioClip(clips[2]!).volume).toBe(1);
    expect(p.production.audioTracks()[0]!.muted).toBe(true);
    for (const action of [
      () => p.production.audioClip("missing"),
      () => p.production.audioClips("missing"),
      () => p.production.audioClips(track, { frame: 1.5 }),
      () => p.production.audioTracks({ offset: -1 }),
    ])
      expect(action).toThrow();
  } finally {
    spy.mockRestore();
  }
  expect(p.toJSON()).toEqual(before);
});

it("authors audio track controls without cloning artwork and preserves undo, rollback and persistence", async () => {
  const p = StoryboardProject.create({ title: "Audio controls" });
  p.addScene("S").addShot("S").addPanel({ durationFrames: 48 }).addVectorLayer("Artwork");
  const asset = p.production.addAsset({
    name: "Cue",
    kind: "audio",
    path: "cue.wav",
    source: "linked",
    mimeType: "audio/wav",
  });
  const before = p.toJSON(),
    spy = jest.spyOn(globalThis, "structuredClone");
  let track = "",
    clip = "";
  try {
    p.transaction("Author cue", () => {
      track = p.production.addAudioTrack("SFX");
      clip = p.production.addAudioClip(track, {
        assetId: asset,
        name: "Click",
        startFrame: 3,
        sourceInFrame: 0,
        durationFrames: 10,
        volume: 0.5,
        fadeInFrames: 1,
        fadeOutFrames: 1,
      });
      p.production.updateAudioClip(track, clip, { startFrame: 4, volume: 0.6 });
      p.production.updateAudioTrack(track, { name: "Mechanism", muted: true, locked: true });
    });
    expect(spy.mock.calls[0]![0]).toEqual([]);
    for (const [value] of spy.mock.calls)
      if (value && typeof value === "object") {
        expect("panels" in value || "layers" in value).toBe(false);
        if (Array.isArray(value))
          expect(
            value.some((entry) => entry && typeof entry === "object" && "layers" in entry),
          ).toBe(false);
      }
  } finally {
    spy.mockRestore();
  }
  const authored = p.toJSON();
  expect(authored.panels).toEqual(before.panels);
  p.transaction("Recover from locked edits", () => {
    for (const action of [
      () => p.production.updateAudioClip(track, clip, { volume: 0.2 }),
      () => p.production.removeAudioClip(track, clip),
      () => p.production.removeAudioTrack(track),
      () => p.production.updateAudioTrack(track, { locked: false, muted: false }),
      () => p.production.updateAudioTrack(track, { muted: 1 as never }),
    ]) {
      const unchanged = p.toJSON();
      expect(action).toThrow();
      expect(p.toJSON()).toEqual(unchanged);
    }
    p.production.updateAudioTrack(track, { locked: false });
    p.production.updateAudioTrack(track, { muted: false });
  });
  p.undo();
  expect(p.toJSON().audioTracks).toEqual(authored.audioTracks);
  p.redo();
  const accepted = p.toJSON();
  expect(() =>
    p.transaction("Mixed rollback", () => {
      p.production.updateAudioClip(track, clip, { volume: 0.1 });
      p.setMetadata("trial", "discard");
      throw new Error("cancel");
    }),
  ).toThrow();
  expect(p.toJSON()).toEqual(accepted);
  const dir = await mkdtemp(join(tmpdir(), "audio-controls-"));
  try {
    await writeFile(join(dir, "cue.wav"), createToneWav({ durationSeconds: 1 }));
    const file = join(dir, "audio.cboard");
    await p.save(file);
    const opened = await StoryboardProject.open(file);
    expect(opened.toJSON().audioTracks).toEqual(accepted.audioTracks);
    opened.production.removeAudioTrack(track);
    expect(opened.toJSON().audioTracks).toEqual([]);
    expect(opened.toJSON().assets).toEqual(accepted.assets);
    opened.undo();
    expect(opened.toJSON().audioTracks).toEqual(accepted.audioTracks);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
