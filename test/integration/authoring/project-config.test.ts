import { expect, it } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { StoryboardProject, brushes, renderFramePNG, createToneWav } from "../../../src/index.js";

function fixture() {
  const project = StoryboardProject.create({ title: "Timebase", width: 64, height: 36 });
  const shot = project.addScene("Scene").addShot("Shot");
  const panel = shot.addPanel({ durationFrames: 24 });
  shot.addPanel({ durationFrames: 24 });
  const layer = panel.addRasterLayer("Ink", { exposure: { startFrame: 0, endFrame: 24 } });
  layer.rasterStroke(
    [
      { x: 4, y: 8, pressure: 0.5, time: 0 },
      { x: 40, y: 8, pressure: 1, time: 120 },
    ],
    brushes.cleanInk,
    { reveal: { startFrame: 0, endFrame: 12 } },
  );
  project.production.addLayerKeyframe(layer.id, 0, { transform: { x: 0 } });
  project.production.addLayerKeyframe(layer.id, 12, { transform: { x: 4 } });
  project.production.addCameraKeyframe(shot.id, 0, { x: 0 });
  project.production.addCameraKeyframe(shot.id, 12, { x: 2 });
  project.production.setTransition(panel.id, { type: "dissolve", durationFrames: 6 });
  const assetId = project.production.addAsset({
    kind: "audio",
    name: "Dialogue",
    path: "dialogue.wav",
    mimeType: "audio/wav",
    source: "linked",
  });
  const track = project.production.addAudioTrack("Dialogue");
  project.production.addAudioClip(track, {
    assetId,
    name: "Line",
    startFrame: 12,
    sourceInFrame: 24,
    durationFrames: 24,
    volume: 1,
    fadeInFrames: 6,
    fadeOutFrames: 6,
  });
  project.production.comment("Beat", { panelId: panel.id, frame: 12 });
  return { project, shot, panel, layer, track };
}

it("converts the whole timebase while preserving rendered poses and source audio seconds", async () => {
  const { project } = fixture(),
    before = project.toJSON();
  const png = await renderFramePNG(project, 6);
  project.configure({ frameRate: { value: 48, timing: "preserve-seconds" } });
  const after = project.toJSON(),
    layer = after.panels[0]!.layers[0]!;
  expect(after.panels.map((p) => [p.startFrame, p.durationFrames])).toEqual([
    [0, 48],
    [48, 48],
  ]);
  expect(after.panels[0]!.transition.durationFrames).toBe(12);
  expect(layer.keyframes.map((k) => k.frame)).toEqual([0, 24]);
  expect(layer.exposure).toEqual({ startFrame: 0, endFrame: 48 });
  expect(layer.kind !== "group" && layer.elements[0]).toMatchObject({
    reveal: { startFrame: 0, endFrame: 24 },
    points: [{ time: 0 }, { time: 120 }],
  });
  expect(after.shots[0]!.cameraKeyframes.map((k) => k.frame)).toEqual([0, 24]);
  expect(after.audioTracks[0]!.clips[0]).toMatchObject({
    startFrame: 24,
    sourceInFrame: 48,
    durationFrames: 48,
    fadeInFrames: 12,
    fadeOutFrames: 12,
  });
  expect(after.comments[0]!.anchor.frame).toBe(24);
  expect(await renderFramePNG(project, 12)).toEqual(png);
  project.undo();
  expect(project.toJSON().panels).toEqual(before.panels);
  expect(project.toJSON().audioTracks).toEqual(before.audioTracks);
  expect(project.toJSON().frameRate).toBe(24);
  project.redo();
  expect(project.toJSON().panels).toEqual(after.panels);
});

it("preserves frame numbers only when explicitly requested and treats no-op edits as no-ops", () => {
  const { project } = fixture(),
    before = project.toJSON();
  project.configure({ frameRate: { value: 30, timing: "preserve-frames" } });
  expect(project.toJSON()).toMatchObject({
    frameRate: 30,
    panels: before.panels,
    audioTracks: before.audioTracks,
  });
  const unchanged = project.toJSON();
  project.configure({ frameRate: { value: 30, timing: "preserve-seconds" } });
  project.configure({});
  expect(project.toJSON()).toEqual(unchanged);
});

it("rejects invalid options and collapsed keys atomically inside an enclosing transaction", () => {
  const { project, layer } = fixture();
  project.production.addLayerKeyframe(layer.id, 1, { opacity: 0.5 });
  project.transaction("Recover configuration", () => {
    const before = project.toJSON();
    for (const changes of [
      { title: "Changed", frameRate: { value: 1, timing: "preserve-seconds" } },
      { frameRate: { value: 30 } },
      { frameRate: { value: 0, timing: "preserve-frames" } },
      { frameRate: { value: 30, timing: "stretch" } },
      { canvas: { width: 8193 } },
      { canvas: { width: NaN } },
      { canvas: { applyTo: "scale" } },
      { unknown: true },
    ]) {
      expect(() => project.configure(changes as never)).toThrow();
      expect(project.toJSON()).toEqual(before);
    }
    project.configure({ title: "Recovered" });
  });
  expect(project.title).toBe("Recovered");
});

it("rejects collapsed drawing exposures, panels, stroke reveals and unsafe frame ranges", () => {
  for (const kind of ["panel", "exposure", "drawing", "reveal", "overflow"]) {
    const project = StoryboardProject.create({ title: kind });
    const panel = project
      .addScene("S")
      .addShot("S")
      .addPanel({ durationFrames: kind === "panel" ? 1 : 24 });
    const layer = panel.addRasterLayer(
      "Ink",
      kind === "exposure" ? { exposure: { startFrame: 0, endFrame: 1 } } : {},
    );
    if (kind === "reveal")
      layer.rasterStroke(
        [
          { x: 1, y: 1 },
          { x: 2, y: 2 },
        ],
        brushes.cleanInk,
        { reveal: { startFrame: 0, endFrame: 1 } },
      );
    if (kind === "drawing") {
      const group = panel.addGroup("Drawings"),
        drawing = panel.addVectorLayer("A", {}, group.id);
      project.production.setDrawingSequence(group.id, [
        { frame: 0, drawingId: drawing.id },
        { frame: 1, drawingId: null },
      ]);
    }
    if (kind === "overflow")
      project.production.addLayerKeyframe(layer.id, Number.MAX_SAFE_INTEGER, { opacity: 0.5 });
    const before = project.toJSON();
    expect(() =>
      project.configure({
        frameRate: { value: kind === "overflow" ? 48 : 1, timing: "preserve-seconds" },
      }),
    ).toThrow(/collapses|safe integer/);
    expect(project.toJSON()).toEqual(before);
  }
});

it("rounds fractional rates at shared panel boundaries without gaps or overlapping audio fades", () => {
  const { project } = fixture();
  project.configure({ frameRate: { value: 24000 / 1001, timing: "preserve-seconds" } });
  const document = project.toJSON();
  expect(document.panels.map((p) => [p.startFrame, p.durationFrames])).toEqual([
    [0, 24],
    [24, 24],
  ]);
  expect(document.audioTracks[0]!.clips[0]).toMatchObject({
    startFrame: 12,
    durationFrames: 24,
    fadeInFrames: 6,
    fadeOutFrames: 6,
  });
  const p = StoryboardProject.create({ title: "Boundary rounding", frameRate: 3 });
  const shot = p.addScene("S").addShot("S");
  for (let i = 0; i < 3; i++) shot.addPanel({ durationFrames: 2 });
  p.configure({ frameRate: { value: 2, timing: "preserve-seconds" } });
  expect(p.toJSON().panels.map((panel) => [panel.startFrame, panel.durationFrames])).toEqual([
    [0, 1],
    [1, 2],
    [3, 1],
  ]);
});

it("resizes only the requested panel scope and persists configuration without changing artwork", async () => {
  const directory = await mkdtemp(join(tmpdir(), "board-config-"));
  try {
    const { project, shot } = fixture(),
      artwork = project.toJSON().panels[0]!.layers;
    project.configure({
      title: "Delivery",
      author: "Artist",
      seed: 42,
      canvas: { width: 128, height: 72, background: "#eeeeee" },
    });
    expect(project.toJSON().panels[0]).toMatchObject({ width: 64, height: 36, layers: artwork });
    const added = shot.addPanel();
    expect(project.toJSON().panels.find((p) => p.id === added.id)).toMatchObject({
      width: 128,
      height: 72,
    });
    project.configure({ author: null, canvas: { width: 96, applyTo: "all-panels" } });
    expect(project.toJSON().panels.map((p) => [p.width, p.height])).toEqual([
      [96, 36],
      [96, 36],
      [96, 72],
    ]);
    expect(project.toJSON().panels[0]!.layers).toEqual(artwork);
    const path = join(directory, "film.cboard");
    await writeFile(join(directory, "dialogue.wav"), createToneWav({ durationSeconds: 3 }));
    await project.save(path);
    expect((await StoryboardProject.open(path)).toJSON()).toEqual(project.toJSON());
    expect(project.toJSON().author).toBeUndefined();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("honors foreign project/panel/layer locks and audio track locks before committing", () => {
  for (const target of ["project", "panel", "layer"] as const) {
    const { project, panel, layer } = fixture();
    project.production.lock(
      target,
      target === "project" ? project.id : target === "panel" ? panel.id : layer.id,
      "Review",
    );
    const other = StoryboardProject.fromJSON(project.toJSON(), { actor: "other" });
    other.transaction("Attempt conversion", () => {
      const before = other.toJSON();
      expect(() =>
        other.configure({ frameRate: { value: 48, timing: "preserve-seconds" } }),
      ).toThrow(/Locked/);
      expect(other.toJSON()).toEqual(before);
    });
  }
  const { project, track } = fixture();
  project.production.updateAudioTrack(track, { locked: true });
  for (const timing of ["preserve-frames", "preserve-seconds"] as const) {
    const before = project.toJSON();
    expect(() => project.configure({ frameRate: { value: 48, timing } })).toThrow(
      /unlocking audio track/,
    );
    expect(project.toJSON()).toEqual(before);
  }
});

it("validates project creation immediately", () => {
  for (const options of [{ title: "" }, { width: 8193 }, { frameRate: 0 }, { seed: 1.5 }])
    expect(() => StoryboardProject.create({ title: "Invalid", ...options })).toThrow();
});

it("applies CLI configuration and leaves the saved project untouched on invalid input", async () => {
  const directory = await mkdtemp(join(tmpdir(), "board-config-cli-"));
  try {
    const path = join(directory, "film.cboard"),
      changes = join(directory, "settings.json");
    const project = StoryboardProject.create({ title: "Original" });
    project.addScene("S").addShot("S").addPanel({ durationFrames: 24 });
    await project.save(path);
    await writeFile(
      changes,
      JSON.stringify({ title: "Delivery", frameRate: { value: 48, timing: "preserve-seconds" } }),
    );
    const run = () =>
      spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", "configure", path, changes], {
        encoding: "utf8",
      });
    const success = run();
    assert.equal(success.status, 0, success.stderr);
    const saved = (await StoryboardProject.open(path)).toJSON();
    expect(saved).toMatchObject({
      title: "Delivery",
      frameRate: 48,
      panels: [{ durationFrames: 48 }],
    });
    await writeFile(
      changes,
      JSON.stringify({
        title: "Must not save",
        frameRate: { value: 0, timing: "preserve-seconds" },
      }),
    );
    expect(run().status).not.toBe(0);
    expect((await StoryboardProject.open(path)).toJSON()).toEqual(saved);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);
