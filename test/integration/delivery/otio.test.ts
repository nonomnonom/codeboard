import { expect, it } from "vitest";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  importOTIO,
  exportOTIO,
  defineShotAnimation,
  defineEditorialSequence,
  resolveEditorialFrame,
  StoryboardProject,
  renderEditorialFramePNG,
  type RationalRate,
} from "../../../src/index.js";

const rate = { numerator: 24, denominator: 1 };
const media = [
  { animationId: "animation:a", targetUrl: "media/shot-a.mov", sourceStartFrame: 1001 },
  { animationId: "animation:b", targetUrl: "media/shot-b.mov" },
];
function sources(frameRate: RationalRate = rate) {
  return ["a", "b"].map((id, index) =>
    defineShotAnimation({
      id: `animation:${id}`,
      shotId: `shot:${id}`,
      name: id,
      frameRate: index ? { numerator: 30, denominator: 1 } : frameRate,
      durationFrames: index ? 60 : 48,
      canvas: { width: 32, height: 32, background: index ? "blue" : "red" },
      layers: [],
      cameraKeyframes: [],
    }),
  );
}
const fixture = () => readFile(new URL("../../fixtures/otio/cuts.otio", import.meta.url), "utf8");
const settings = { sequenceId: "edit", frameRate: rate, media, lossPolicy: "report" as const };

it("conforms the official OTIO fixture with mixed rates, source origin and explicit loss reports", async () => {
  const json = await fixture();
  const animations = sources();
  expect(() => importOTIO(json, animations, { ...settings, lossPolicy: "reject" })).toThrow(/name/);
  const { sequence, losses } = importOTIO(json, animations, settings);
  expect(losses.map((loss) => loss.path)).toEqual([
    "/name",
    "/tracks/name",
    "/tracks/children/0/children/0/name",
    "/tracks/children/0/children/1/name",
  ]);
  expect(
    sequence.clips.map(({ animationId, startFrame, sourceInFrame, durationFrames }) => [
      animationId,
      startFrame,
      sourceInFrame,
      durationFrames,
    ]),
  ).toEqual([
    ["animation:b", 0, 6, 24],
    ["animation:a", 24, 6, 18],
  ]);
  for (const [frame, local] of [
    [0, 6],
    [23, 34],
    [24, 6],
    [41, 23],
  ])
    expect(resolveEditorialFrame(sequence, animations, frame!).outgoing.sourceFrame).toBe(local);
  const exported = exportOTIO(sequence, animations, { media });
  expect(exported.losses).toEqual([]);
  expect(
    importOTIO(exported.json, animations, { ...settings, lossPolicy: "reject" }).sequence,
  ).toEqual(sequence);
  expect(animations).toEqual(sources());
});

it("round-trips a rational-rate sequence and fails instead of rounding incompatible edits", () => {
  const fps = { numerator: 24000, denominator: 1001 };
  const animations = sources(fps);
  const sequence = defineEditorialSequence(
    {
      id: "edit",
      frameRate: fps,
      clips: [
        {
          id: "clip:a",
          animationId: "animation:a",
          startFrame: 0,
          sourceInFrame: 7,
          durationFrames: 19,
          transition: { type: "cut", durationFrames: 0 },
        },
      ],
    },
    animations,
  );
  const result = exportOTIO(sequence, animations, { media });
  expect(
    importOTIO(result.json, animations, { sequenceId: "edit", frameRate: fps, media }).sequence,
  ).toEqual(sequence);
  expect(() =>
    importOTIO(result.json, animations, { sequenceId: "edit", frameRate: rate, media }),
  ).toThrow(/time cannot be represented/);
});

it("imports the official Clip.1 downgrade with the same source ranges", async () => {
  const legacy = await readFile(
    new URL("../../fixtures/otio/cuts-v1.otio", import.meta.url),
    "utf8",
  );
  expect(importOTIO(legacy, sources(), settings).sequence).toEqual(
    importOTIO(await fixture(), sources(), settings).sequence,
  );
});

it("reports native audio omissions and rejects oversized loss reports", async () => {
  const animations = sources();
  const { sequence } = importOTIO(await fixture(), animations, settings);
  sequence.audio = [{ id: "audio:editorial", name: "Edit sound", muted: false, clips: [] }];
  animations[0]!.audio = [{ id: "audio:shot", name: "Shot sound", muted: false, clips: [] }];
  expect(() => exportOTIO(sequence, animations, { media })).toThrow(/audio/);
  const exported = exportOTIO(sequence, animations, { media, lossPolicy: "report" });
  expect(exported.losses.map((loss) => loss.path)).toEqual([
    "/audio",
    "/animations/animation:a/audio",
  ]);
  expect(importOTIO(exported.json, animations, settings).sequence.audio).toBeUndefined();
  const value = JSON.parse(await fixture());
  value.metadata = Object.fromEntries(
    Array.from({ length: 100 }, (_, index) => [`${index}${"x".repeat(3000)}`, true]),
  );
  expect(() => importOTIO(JSON.stringify(value), animations, settings)).toThrow(/256 KiB/);
});

it("rejects missing media, unsupported structure, range mismatch and unsafe JSON without mutating inputs", async () => {
  const original = JSON.parse(await fixture());
  const animations = sources();
  const cases: Array<[string, (value: typeof original) => void]> = [
    [
      "OTIO_SCHEMA",
      (v) => {
        v.tracks.children[0].children[0].OTIO_SCHEMA = "Gap.1";
      },
    ],
    [
      "effects",
      (v) => {
        v.tracks.children[0].children[0].effects = [
          { OTIO_SCHEMA: "LinearTimeWarp.1", time_scalar: 2 },
        ];
      },
    ],
    [
      "source_range",
      (v) => {
        v.tracks.source_range = v.tracks.children[0].children[0].source_range;
      },
    ],
    [
      "enabled",
      (v) => {
        v.tracks.children[0].children[0].enabled = false;
      },
    ],
    [
      "Exactly one",
      (v) => {
        v.tracks.children.push(structuredClone(v.tracks.children[0]));
      },
    ],
    [
      "target_url",
      (v) => {
        v.tracks.children[0].children[0].media_references.DEFAULT_MEDIA.target_url = "unmapped.mov";
      },
    ],
    [
      "available_range",
      (v) => {
        v.tracks.children[0].children[0].media_references.DEFAULT_MEDIA.available_range.duration.value = 61;
      },
    ],
    [
      "outside",
      (v) => {
        v.tracks.children[0].children[1].source_range.start_time.value = 1000;
      },
    ],
    [
      "time cannot",
      (v) => {
        v.tracks.children[0].children[0].source_range.duration.value = 1;
      },
    ],
  ];
  for (const [message, change] of cases) {
    const value = structuredClone(original);
    change(value);
    expect(() => importOTIO(JSON.stringify(value), animations, settings)).toThrow(message);
  }
  expect(() => importOTIO("{", animations, settings)).toThrow(/Invalid JSON/);
  expect(() => importOTIO(" ".repeat(1048577), animations, settings)).toThrow(/1 MiB/);
  expect(() =>
    importOTIO(JSON.stringify(original), animations, { ...settings, media: [...media, media[0]!] }),
  ).toThrow(/unique/);
  expect(animations).toEqual(sources());
});

it("requires explicit omission for metadata and audio, and rejects transitions even in report mode", async () => {
  const value = JSON.parse(await fixture());
  value.tracks.children.push({ OTIO_SCHEMA: "Track.1", kind: "Audio", children: [] });
  value.tracks.children[0].children[0].markers = [{ OTIO_SCHEMA: "Marker.2", name: "Review" }];
  value.metadata = { review: "pending" };
  const animations = sources();
  const result = importOTIO(JSON.stringify(value), animations, settings);
  expect(result.losses.map((loss) => loss.path)).toContain("/tracks/children/1");
  expect(result.losses.map((loss) => loss.path)).toContain("/metadata/review");
  expect(result.losses.map((loss) => loss.path)).toContain("/tracks/children/0/children/0/markers");
  const sequence = result.sequence;
  sequence.clips[0]!.transition = { type: "dissolve", durationFrames: 3 };
  sequence.clips[1]!.startFrame = 21;
  expect(() => exportOTIO(sequence, animations, { media, lossPolicy: "report" })).toThrow(
    /Only cuts/,
  );
});

it("commits an imported cut through native plans, reopens it and retries without changing artwork", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-otio-"));
  try {
    const project = StoryboardProject.create({ title: "Conform", width: 32, height: 32 });
    const animations = sources();
    const scene = project.addScene("Conform");
    for (const source of animations) {
      source.shotId = scene.addShot(source.name).id;
      project.putShotAnimation(source);
    }
    const path = join(directory, "conform.cboard");
    await project.save(path);
    const result = importOTIO(await fixture(), animations, settings);
    const plan = project.plan("Conform cut list", [
      { op: "editorial.put", sequence: result.sequence },
    ]);
    const receipt = await project.commit(plan, { requestId: "otio:conform" });
    const reopened = await StoryboardProject.open(path);
    expect(await reopened.commit(plan, { requestId: "otio:conform" })).toEqual({
      ...receipt,
      replayed: true,
    });
    expect(reopened.editorialSequence("edit")).toEqual(result.sequence);
    expect(reopened.studio.animations).toEqual(animations);
    expect(
      await renderEditorialFramePNG(reopened.editorialSequence("edit"), animations, 24),
    ).toEqual(await renderEditorialFramePNG(result.sequence, animations, 24));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
