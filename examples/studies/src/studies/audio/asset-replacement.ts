import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  StoryboardProject,
  createToneWav,
  createFFmpegAudioDecoder,
  mixShotAudio,
  exportShotMovie,
  renderFramePNG,
} from "codeboard-studio";
import { motion } from "../../shared/motion.ts";
import { make, text, ink, blue } from "../../shared.ts";
import { report } from "../../shared/artifacts.ts";

const checksum = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

export async function generate(output: string): Promise<void> {
  const { project } = motion("Replace missing audio safely", 24);
  const before = createToneWav({
    frequency: 220,
    durationSeconds: 1,
    volume: 0.4,
    attackSeconds: 0,
    releaseSeconds: 0,
  });
  const after = createToneWav({
    frequency: 880,
    durationSeconds: 1,
    volume: 0.4,
    attackSeconds: 0,
    releaseSeconds: 0,
  });
  await writeFile(join(output, "original.wav"), before);
  const assetId = project.production.addAsset({
    kind: "audio",
    name: "Replaceable tone",
    path: "original.wav",
    source: "managed",
    mimeType: "audio/wav",
    checksum: checksum(before),
  });
  project.setStudioAudio("animation:study", [
    {
      id: "track:tone",
      name: "Tone",
      muted: false,
      clips: [
        {
          id: "clip:tone",
          assetId,
          name: "Tone",
          start: { ticks: 0, rate: { numerator: 24, denominator: 1 } },
          source: { sampleRate: 48000, startSample: 0, sampleCount: 48000 },
          volume: 1,
          fadeInSamples: 0,
          fadeOutSamples: 0,
        },
      ],
    },
  ]);
  const source = join(output, "asset-replacement.cboard");
  await project.save(source);
  const initial = project.toJSON();
  const originalMix = await mixShotAudio(
    project.shotAnimation("animation:study"),
    createFFmpegAudioDecoder(project.captureAssetReader()),
    { rounding: "exact" },
  );
  const plan = project.plan("Replace tone source", [
    {
      op: "asset.update",
      id: assetId,
      changes: { path: "replacement.wav", checksum: checksum(after) },
    },
  ]);
  await assert.rejects(project.commit(plan, { requestId: "replace:tone" }), {
    code: "ASSET_MISSING",
  });
  assert.deepEqual(project.toJSON(), initial);
  assert.deepEqual((await StoryboardProject.open(source)).readAsset(assetId), before);
  await writeFile(join(output, "replacement.wav"), after);
  const committed = await project.commit(plan, { requestId: "replace:tone" });
  const reopened = await StoryboardProject.open(source);
  assert.deepEqual(reopened.readAsset(assetId), after);
  assert.equal((await reopened.commit(plan, { requestId: "replace:tone" })).replayed, true);
  const decoder = createFFmpegAudioDecoder(reopened.captureAssetReader());
  const replacementMix = await mixShotAudio(reopened.shotAnimation("animation:study"), decoder, {
    rounding: "exact",
  });
  const diagram = make("Decoded source replacement", 840, 370);
  const layer = diagram
    .addScene("Evidence")
    .addShot("Waveforms")
    .addPanel()
    .addVectorLayer("Decoded samples");
  text(layer, "Replace a low tone with a high tone", 30, 36, 23);
  for (const [index, samples] of [originalMix.channels[0], replacementMix.channels[0]].entries()) {
    const y = 128 + index * 154;
    text(
      layer,
      index === 0 ? "Before: low tone, 220 Hz" : "After: high tone, 880 Hz",
      30,
      y - 47,
      19,
    );
    layer.path(
      [
        { op: "M", x: 30, y },
        { op: "L", x: 810, y },
      ],
      { stroke: ink, strokeWidth: 1 },
    );
    const points = Array.from({ length: 780 }, (_, x) => ({
      x: x + 30,
      y: y - samples![Math.floor((x * 960) / 780)]! * 80,
    }));
    layer.path(
      points.map((point, i) => ({ op: i === 0 ? ("M" as const) : ("L" as const), ...point })),
      { stroke: blue, strokeWidth: 1.5 },
    );
  }
  text(layer, "First 20 ms of each decoded 48 kHz mix", 30, 354, 17);
  await writeFile(join(output, "asset-replacement.png"), await renderFramePNG(diagram, 0));
  await exportShotMovie(
    reopened.shotAnimation("animation:study"),
    join(output, "asset-replacement.mp4"),
    { audio: { mode: "mix", decoder, transitions: "sum" } },
  );
  await report(output, "replacement", {
    beforeChecksum: checksum(before),
    afterChecksum: checksum(after),
    committed,
    missingSourceRejected: true,
    retryReplayed: true,
    decodedSamples: replacementMix.channels[0].length,
  });
}
