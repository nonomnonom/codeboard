import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { author } from "../examples/studio-timing/src/project/author.ts";
import { revise } from "../examples/studio-timing/src/project/revise.ts";
import { movie, review } from "../examples/studio-timing/src/review/export.ts";
import { StoryboardProject, renderShotFramePNG } from "codeboard-studio";

const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
});
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-studio-example-"));
  folders.push(directory);
  const project = await author(directory);
  return { directory, project, file: join(directory, "timing.cboard") };
}

it("hands off saved studio state, replays a persisted revision and preserves shot artwork", async () => {
  const { directory, project, file } = await fixture();
  const animations = project.studio.animations;
  const before = await renderShotFramePNG(animations[0]!, 60);
  const committed = await revise(directory);
  const replay = await revise(directory);
  expect(committed.replayed).toBe(false);
  expect(replay.replayed).toBe(true);
  expect(replay.receipt).toEqual(committed.receipt);
  const opened = await StoryboardProject.open(file);
  expect(opened.studio.animations).toEqual(animations);
  expect(await renderShotFramePNG(opened.shotAnimation(animations[0]!.id), 60)).toEqual(before);
  const sequence = opened.editorialSequence("timing-edit");
  expect(sequence.clips.map((clip) => [clip.id, clip.durationFrames, clip.sourceInFrame])).toEqual([
    ["cut-1", 132, 0],
    ["cut-0", 108, 12],
  ]);
  const bytes = await readFile(file);
  const evidence = await review(directory);
  const cue = await readFile(join(directory, "cue-0.wav"));
  await expect(author(directory)).rejects.toThrow("Project already exists");
  expect(await readFile(join(directory, "cue-0.wav"))).toEqual(cue);
  expect(evidence.manifest.source.version).toBe(opened.version);
  expect(evidence.manifest.frames).toHaveLength(7);
  expect(await readFile(file)).toEqual(bytes);
});

const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH ?? "ffprobe";
const hasMedia = [ffmpeg, ffprobe].every(
  (executable) =>
    spawnSync(executable, ["-version"], { windowsHide: true, stdio: "ignore" }).status === 0,
);

(hasMedia ? it : it.skip)(
  "exports ten seconds with 240 frames and audible cues at revised editorial positions",
  async () => {
    const { directory, file } = await fixture();
    await revise(directory);
    const bytes = await readFile(file);
    const result = await movie(directory);
    expect(result.frames).toBe(240);
    expect(result.seconds).toBe(10);
    expect(result.audio).toMatchObject({ mode: "mixed", samples: 480000, clippedSamples: 0 });
    const probe = spawnSync(
      ffprobe,
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type,codec_name,duration,nb_frames,sample_rate",
        "-of",
        "json",
        result.file,
      ],
      { encoding: "utf8", windowsHide: true },
    );
    expect(probe.status).toBe(0);
    expect(JSON.parse(probe.stdout).streams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          codec_type: "video",
          codec_name: "h264",
          nb_frames: "240",
          duration: "10.000000",
        }),
        expect.objectContaining({
          codec_type: "audio",
          codec_name: "aac",
          sample_rate: "48000",
          duration: "10.000000",
        }),
      ]),
    );
    const decoded = spawnSync(
      ffmpeg,
      [
        "-v",
        "error",
        "-i",
        result.file,
        "-map",
        "0:a:0",
        "-ac",
        "1",
        "-ar",
        "48000",
        "-f",
        "f32le",
        "pipe:1",
      ],
      { windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
    );
    expect(decoded.status).toBe(0);
    const rms = (start: number, end: number) => {
      let sum = 0;
      for (let sample = start * 48000; sample < end * 48000; sample++)
        sum += decoded.stdout.readFloatLE(sample * 4) ** 2;
      return Math.sqrt(sum / ((end - start) * 48000));
    };
    for (const [start, end] of [
      [0, 0.4],
      [1.7, 5.3],
      [7, 9.9],
    ])
      expect(rms(start!, end!)).toBeLessThan(0.001);
    for (const [start, end] of [
      [0.6, 1.4],
      [5.6, 6.4],
    ])
      expect(rms(start!, end!)).toBeGreaterThan(0.1);
    expect(await readFile(file)).toEqual(bytes);
  },
);
