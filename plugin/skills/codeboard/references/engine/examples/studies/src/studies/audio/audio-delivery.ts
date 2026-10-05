import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createToneWav,
  createFFmpegAudioDecoder,
  mixShotAudio,
  encodeWav,
  exportAudioStems,
  verifyAudioStems,
  exportShotMovie,
  exportMovie,
  renderFramePNG,
} from "codeboard-studio";
import { motion } from "../../shared/motion.ts";
import { blue, ink, make, rect, save, text } from "../../shared.ts";
import { report } from "../../shared/artifacts.ts";
import { captureAudioBoard } from "./board-capture.ts";

export async function render(output: string): Promise<void> {
  const { project } = motion("Audio trim, placement and delivery", 48);
  const file = join(output, "cue.wav");
  await writeFile(file, createToneWav({ frequency: 440, durationSeconds: 1, volume: 0.4 }));
  const assetId = project.production.addAsset({
    id: "asset:tone",
    name: "Generated 440 Hz tone",
    kind: "audio",
    path: file,
    mimeType: "audio/wav",
    source: "linked",
  });
  const trackId = project.production.addAudioTrack("Board cue");
  project.production.addAudioClip(trackId, {
    assetId,
    name: "Trimmed cue",
    startFrame: 12,
    sourceInFrame: 6,
    durationFrames: 12,
    volume: 0.7,
    fadeInFrames: 3,
    fadeOutFrames: 3,
  });
  project.setStudioAudio("animation:study", [
    {
      id: "track:cue",
      name: "Shot cue",
      muted: false,
      clips: [
        {
          id: "cue:shot",
          assetId,
          name: "Trimmed cue",
          start: { ticks: 12, rate: { numerator: 24, denominator: 1 } },
          source: { sampleRate: 48000, startSample: 12000, sampleCount: 24000 },
          volume: 0.7,
          fadeInSamples: 6000,
          fadeOutSamples: 6000,
        },
      ],
    },
  ]);
  project.editStudioAudio("animation:study", [
    { op: "clip.split", id: "cue:shot", atSample: 12000, newId: "cue:shot-right" },
  ]);
  await project.save(join(output, "audio-delivery.cboard"));
  const decoder = createFFmpegAudioDecoder(project.captureAssetReader());
  const animation = project.shotAnimation("animation:study");
  const mix = await mixShotAudio(animation, decoder, { rounding: "exact" });
  assert.equal(mix.channels[0].length, 96000);
  assert.equal(mix.clippedSamples, 0);
  assert.ok(mix.peak > 0);
  await writeFile(join(output, "mix.wav"), encodeWav(mix.channels, mix.sampleRate));
  await exportAudioStems({ kind: "shot", animation }, decoder, join(output, "stems"), {
    stems: [{ name: "Cue", tracks: [{ ownerId: animation.id, trackId: "track:cue" }] }],
    transitions: "sum",
    sampleFormat: "pcm16",
  });
  const verified = await verifyAudioStems(join(output, "stems"));
  const diagram = make("Measured audio amplitude", 960, 400);
  const layer = diagram
    .addScene("Inspection")
    .addShot("PCM waveform")
    .addPanel()
    .addVectorLayer("Waveform");
  text(layer, "Decoded shot mix · 48 kHz stereo", 35, 42, 25);
  text(layer, "Trim source 0.25–0.75s; play at 0.5–1.0s", 35, 82, 20);
  rect(layer, 60, 245, 840, 1, ink);
  for (let x = 0; x < 840; x++) {
    const start = Math.floor((x * mix.channels[0].length) / 840),
      end = Math.floor(((x + 1) * mix.channels[0].length) / 840);
    let peak = 0;
    for (let sample = start; sample < end; sample++)
      peak = Math.max(peak, Math.abs(mix.channels[0][sample]!));
    if (peak) rect(layer, x + 60, 245 - peak * 320, 1, peak * 640, blue);
  }
  for (const [seconds, x] of [
    [0, 60],
    [0.5, 270],
    [1, 480],
    [1.5, 690],
    [2, 900],
  ])
    text(layer, `${seconds}s`, x! - 10, 355, 18);
  text(
    layer,
    `Peak ${mix.peak.toFixed(3)} · ${verified.manifest.stems[0]!.samples} samples per stem`,
    35,
    390,
    18,
  );
  await save(output, "audio-delivery", project, await renderFramePNG(diagram, 0));
  await exportShotMovie(
    project.shotAnimation("animation:study"),
    join(output, "audio-delivery.mp4"),
    {
      audio: {
        mode: "mix",
        decoder: createFFmpegAudioDecoder(project.captureAssetReader()),
        transitions: "sum",
      },
    },
  );
  await exportMovie(project, join(output, "board-audio.mp4"));
  await report(output, "audio", {
    boardCapture: await captureAudioBoard(output, mix),
    range: mix.range,
    peak: mix.peak,
    clippedSamples: mix.clippedSamples,
    stem: verified.manifest,
  });
}
