import { expect, it, vi } from "vitest";
import { mkdtemp, rm, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { FontLibrary } from "skia-canvas";
import {
  exportMovie,
  exportShotMovie,
  exportEditorialMovie,
  StoryboardProject,
  inspectProjectFonts,
  inspectShotFonts,
  createFrameJob,
  runFrameJob,
  inspectFrameJob,
} from "../../../src/index.js";

it("rejects missing fonts before movie output and studio audio decoding", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-font-movies-"));
  try {
    const { project } = fixture('20px "Missing Export Font 98142", serif');
    const animation = project.shotAnimation("animation:fonts");
    animation.audio = [
      {
        id: "track:font",
        name: "Cue",
        muted: false,
        clips: [
          {
            id: "clip:cue",
            assetId: "asset:tone",
            name: "Cue",
            start: { ticks: 0, rate: animation.frameRate },
            source: { sampleRate: 48000, startSample: 0, sampleCount: 4000 },
            volume: 1,
            fadeInSamples: 0,
            fadeOutSamples: 0,
          },
        ],
      },
    ];
    const decoder = vi.fn(async () => {
      throw new Error("Audio decoding must not start");
    });
    const options = {
      fontPolicy: "require-available" as const,
      audio: { mode: "mix" as const, decoder, transitions: "sum" as const },
    };
    const sequence = {
      id: "edit:fonts",
      frameRate: animation.frameRate,
      clips: [
        {
          id: "clip:fonts",
          animationId: animation.id,
          startFrame: 0,
          sourceInFrame: 0,
          durationFrames: 2,
          transition: { type: "cut" as const, durationFrames: 0 },
        },
      ],
    };
    const output = join(directory, "absent", "movie.mp4");
    for (const operation of [
      () => exportMovie(project, output, { fontPolicy: "require-available" }),
      () => exportShotMovie(animation, output, options),
      () => exportEditorialMovie(sequence, [animation], output, options),
    ])
      await expect(operation()).rejects.toMatchObject({ code: "MISSING_DEPENDENCY" });
    expect(decoder).not.toHaveBeenCalled();
    await expect(
      exportShotMovie(animation, output, { ...options, fontPolicy: "allow-fallback" }),
    ).rejects.toThrow("Audio decoding must not start");
    expect(decoder).toHaveBeenCalledTimes(1);
    await expect(access(join(directory, "absent"))).rejects.toThrow();
    await expect(
      exportShotMovie(animation, output, { fontPolicy: "unknown" as "require-available" }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function fixture(font: string) {
  const project = StoryboardProject.create({ title: "Font dependencies", width: 120, height: 80 });
  const panel = project.addScene("S").addShot("S").addPanel({ durationFrames: 2 });
  const layer = panel.addVectorLayer("Text");
  const elementId = layer.text("Hello 漢", 5, 30, { font, color: "#112233" });
  project.capturePanelAnimation(panel.id, { id: "animation:fonts" });
  return { project, elementId };
}

it("reports generic mappings, actual resolved families and unavailable quoted families", () => {
  const { project } = fixture('italic bold 20px/1.5 "Codeboard, Missing Font", sans-serif');
  const report = inspectShotFonts(project.shotAnimation("animation:fonts"));
  expect(report.available).toBe(false);
  expect(report.elements[0]).toMatchObject({
    ownerId: "animation:fonts",
    issue: "missing-family",
    families: [
      { name: "Codeboard, Missing Font", status: "missing" },
      { name: "sans-serif", status: "generic" },
    ],
  });
  expect(report.elements[0]!.resolvedFamilies.length).toBeGreaterThan(0);
  expect(inspectProjectFonts(project).elements).toHaveLength(2);
  expect(
    inspectShotFonts(fixture("20px sans-serif").project.shotAnimation("animation:fonts")).available,
  ).toBe(true);
});

it("rejects invalid or unsupported declarations instead of inheriting a previous font", () => {
  for (const [font, issue] of [
    ["nonsense", "invalid-declaration"],
    ['20px "Escaped\\ Family"', "unsupported-declaration"],
  ]) {
    const { project } = fixture(font!);
    expect(inspectShotFonts(project.shotAnimation("animation:fonts")).elements[0]!.issue).toBe(
      issue,
    );
  }
  expect(
    inspectShotFonts(fixture("11px monospace").project.shotAnimation("animation:fonts")).available,
  ).toBe(true);
  expect(
    inspectShotFonts(fixture("13px serif").project.shotAnimation("animation:fonts")).available,
  ).toBe(true);
});

it("strict jobs fail before creation and default jobs preserve fallback behavior", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-fonts-"));
  try {
    const { project } = fixture('20px "Codeboard Missing 98142", serif');
    const source = join(directory, "source.cboard"),
      job = join(directory, "job.sqlite");
    await project.save(source);
    const options = {
      expectedVersion: project.version,
      target: { kind: "shot" as const, animationId: "animation:fonts" },
    };
    expect(() =>
      createFrameJob(source, job, { ...options, fontPolicy: "require-available" }),
    ).toThrow(/font dependencies/);
    await expect(access(job)).rejects.toThrow();
    createFrameJob(source, job, options);
    expect((await runFrameJob(job)).rendered).toBe(2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("rechecks dynamically loaded font availability before resuming any frames", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-font-resume-"));
  const alias = "Codeboard Test Font 98142";
  const path = resolve("website/public/fonts/dm-sans.woff2");
  try {
    FontLibrary.use(alias, path);
    const { project } = fixture(`20px "${alias}"`);
    const source = join(directory, "source.cboard"),
      job = join(directory, "job.sqlite");
    await project.save(source);
    createFrameJob(source, job, {
      expectedVersion: project.version,
      target: { kind: "shot", animationId: "animation:fonts" },
      fontPolicy: "require-available",
    });
    await runFrameJob(job, { range: { startFrame: 0, endFrame: 1 } });
    FontLibrary.reset();
    await expect(runFrameJob(job)).rejects.toThrow(/font dependencies/);
    expect(inspectFrameJob(job).completed).toBe(1);
    FontLibrary.use(alias, path);
    const resumed = await runFrameJob(job);
    expect(resumed.rendered).toBe(1);
    expect(resumed.reused).toBe(1);
  } finally {
    FontLibrary.reset();
    await rm(directory, { recursive: true, force: true });
  }
});

it("preflights hidden drawings and only the shots referenced by an editorial job", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-font-edit-"));
  try {
    const { project } = fixture("20px serif");
    const unused = project.shotAnimation("animation:fonts");
    unused.id = "animation:unused";
    const layer = unused.layers[0]!;
    layer.id = "layer:unused";
    layer.visible = false;
    if (layer.kind === "group" || layer.elements[0]?.kind !== "text")
      throw new Error("Missing fixture text");
    layer.elements[0].font = '20px "Missing Hidden Font 98142"';
    layer.elements[0].id = "element:unused";
    project.putShotAnimation(unused);
    expect(inspectShotFonts(unused).available).toBe(false);
    project.putEditorialSequence({
      id: "edit:fonts",
      frameRate: { numerator: 24, denominator: 1 },
      clips: [
        {
          id: "clip:fonts",
          animationId: "animation:fonts",
          startFrame: 0,
          sourceInFrame: 0,
          durationFrames: 2,
          transition: { type: "cut", durationFrames: 0 },
        },
      ],
    });
    const source = join(directory, "source.cboard"),
      job = join(directory, "job.sqlite");
    await project.save(source);
    expect(inspectProjectFonts(project).available).toBe(false);
    createFrameJob(source, job, {
      expectedVersion: project.version,
      target: { kind: "editorial", sequenceId: "edit:fonts" },
      fontPolicy: "require-available",
    });
    expect((await runFrameJob(job)).rendered).toBe(2);
    expect(() =>
      createFrameJob(source, join(directory, "hidden.sqlite"), {
        expectedVersion: project.version,
        target: { kind: "shot", animationId: unused.id },
        fontPolicy: "require-available",
      }),
    ).toThrow(/font dependencies/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
