import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StoryboardProject, createToneWav } from "../src/index.js";

it("splits source-contiguous clips with stable left identity, retained outer fades and no extra asset", async () => {
  const p = StoryboardProject.create({ title: "Split cue" }),
    asset = p.production.addAsset({
      name: "Cue",
      kind: "audio",
      source: "managed",
      path: "cue.wav",
      mimeType: "audio/wav",
    }),
    track = p.production.addAudioTrack("Effects");
  const id = p.production.addAudioClip(track, {
      assetId: asset,
      name: "Mechanism",
      startFrame: 10,
      sourceInFrame: 3,
      durationFrames: 12,
      volume: 0.6,
      fadeInFrames: 2,
      fadeOutFrames: 3,
    }),
    original = p.production.audioClip(id);
  let rightId = "";
  p.transaction("Correct split", () => {
    const before = p.toJSON();
    for (const frame of [-1, 10, 11, 20, 22, 23, 12.5]) {
      expect(() => p.production.splitAudioClip(id, frame)).toThrow();
      expect(p.toJSON()).toEqual(before);
    }
    expect(() => p.production.splitAudioClip(id, 16, { expectedVersion: p.version - 1 })).toThrow();
    expect(p.toJSON()).toEqual(before);
    rightId = p.production.splitAudioClip(id, 16);
  });
  expect(rightId).not.toBe(id);
  expect(p.production.audioClip(id)).toEqual({ ...original, durationFrames: 6, fadeOutFrames: 0 });
  expect(p.production.audioClip(rightId)).toEqual({
    ...original,
    id: rightId,
    startFrame: 16,
    sourceInFrame: 9,
    durationFrames: 6,
    fadeInFrames: 0,
  });
  expect(p.production.audioClips(track).map((clip) => clip.id)).toEqual([id, rightId]);
  expect(p.toJSON().assets).toHaveLength(1);
  const split = p.toJSON();
  expect(() => p.production.splitAudioClip(id, 16)).toThrow(/inside/);
  expect(p.toJSON()).toEqual(split);
  p.undo();
  expect(p.production.audioClip(id)).toEqual(original);
  expect(p.production.audioClips(track)).toHaveLength(1);
  p.redo();
  p.production.updateAudioTrack(track, { locked: true });
  const locked = p.toJSON();
  expect(() => p.production.splitAudioClip(rightId, 18)).toThrow(/locked/);
  expect(p.toJSON()).toEqual(locked);
  const directory = await mkdtemp(join(tmpdir(), "audio-split-"));
  try {
    await writeFile(join(directory, "cue.wav"), createToneWav({ durationSeconds: 1 }));
    const file = join(directory, "cue.cboard");
    await p.save(file);
    const reopened = await StoryboardProject.open(file);
    expect(reopened.production.audioClips(track)).toEqual(p.production.audioClips(track));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
