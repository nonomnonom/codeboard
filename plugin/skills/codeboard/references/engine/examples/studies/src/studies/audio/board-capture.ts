import assert from "node:assert/strict";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import {
  StoryboardProject,
  planBoardCapture,
  createFFmpegAudioDecoder,
  mixEditorialAudio,
  encodeWav,
  type AudioMixResult,
} from "codeboard-studio";

/** Continue the trimmed-cue fixture on a separate saved project with real WAV decoding. */
export async function captureAudioBoard(output: string, baseline: AudioMixResult) {
  const original = join(output, "audio-delivery.cboard");
  const project = await StoryboardProject.open(original);
  const sourceTracks = project.production.audioTracks();
  const sourceClips = sourceTracks.map((track) => project.production.audioClips(track.id));
  const file = join(output, "audio-board-capture.cboard");
  await project.save(file);
  const capture = planBoardCapture(project, {
    sequenceId: "edit:audio-board",
    panels: project.boardPanels().map((panel, index) => ({
      panelId: panel.id,
      animationId: `animation:audio-board:${index}`,
      clipId: `clip:audio-board:${index}`,
    })),
    audio: { mode: "convert", sampleRates: { "asset:tone": 48000 }, rounding: "exact" },
  });
  await writeFile(join(output, "audio-board-capture-plan.json"), JSON.stringify(capture, null, 2));
  const committed = await project.commit(capture.plan, { requestId: "capture-audio-board" });
  const reopened = await StoryboardProject.open(file);
  assert.deepEqual(reopened.production.audioTracks(), sourceTracks);
  for (const [index, track] of sourceTracks.entries())
    assert.deepEqual(reopened.production.audioClips(track.id), sourceClips[index]);
  assert.deepEqual(await reopened.commit(capture.plan, { requestId: "capture-audio-board" }), {
    ...committed,
    replayed: true,
  });
  const sequence = reopened.editorialSequence(capture.sequenceId);
  const clip = sequence.audio![0]!.clips[0]!;
  assert.deepEqual(clip.source, { sampleRate: 48000, startSample: 12000, sampleCount: 24000 });
  assert.deepEqual(clip.start, { ticks: 12, rate: { numerator: 24, denominator: 1 } });
  assert.equal(clip.fadeInSamples, 6000);
  assert.equal(clip.fadeOutSamples, 6000);
  assert.equal(capture.audio.quantizedPositions, 0);
  const decoder = createFFmpegAudioDecoder(reopened.captureAssetReader());
  const mix = await mixEditorialAudio(sequence, reopened.studio.animations, decoder, {
    transitions: "sum",
    rounding: "exact",
  });
  assert.deepEqual(mix.channels, baseline.channels);
  assert.equal(mix.clippedSamples, 0);
  await writeFile(join(output, "audio-board-capture.wav"), encodeWav(mix.channels, mix.sampleRate));

  // Shot sound starts after the held picture; sequence sound remains at its original clock.
  const held = {
    id: "edit:held-audio",
    frameRate: sequence.frameRate,
    clips: [
      {
        id: "clip:held-audio",
        animationId: "animation:study",
        startFrame: 0,
        sourceInFrame: 0,
        holdFrames: 6,
        durationFrames: 54,
        transition: { type: "cut" as const, durationFrames: 0 },
      },
    ],
  };
  const heldMix = await mixEditorialAudio(held, reopened.studio.animations, decoder, {
    transitions: "sum",
    rounding: "exact",
  });
  assert.equal(heldMix.channels[0].length, 108000);
  for (const [index, channel] of heldMix.channels.entries()) {
    assert.ok(channel.subarray(0, 12000).every((sample) => sample === 0));
    assert.deepEqual(channel.subarray(12000), baseline.channels[index]);
  }
  assert.equal(heldMix.conform.windows[0]!.playbackStart!.value, 12000);
  const layered = await mixEditorialAudio(
    { ...held, audio: sequence.audio! },
    reopened.studio.animations,
    decoder,
    { transitions: "sum", rounding: "exact" },
  );
  let maxLayeredSampleError = 0;
  const layeredSampleTolerance = 2 ** -24;
  assert.equal(layered.clippedSamples, 0);
  for (const [index, channel] of layered.channels.entries()) {
    const expected = Float32Array.from(
      heldMix.channels[index]!,
      (sample, at) => sample + (baseline.channels[index]![at] ?? 0),
    );
    assert.equal(channel.length, expected.length);
    // Separate mixes round each contribution before summing; the mixer rounds each accumulated sample.
    for (let at = 0; at < channel.length; at++) {
      const error = Math.abs(channel[at]! - expected[at]!);
      assert.ok(
        error <= layeredSampleTolerance,
        `Layered PCM differs at channel ${index}, sample ${at}`,
      );
      maxLayeredSampleError = Math.max(maxLayeredSampleError, error);
    }
  }
  await writeFile(
    join(output, "audio-held-shot.wav"),
    encodeWav(heldMix.channels, heldMix.sampleRate),
  );
  return {
    source: capture.source,
    receipt: committed.receipt,
    conversion: capture.audio,
    conform: mix.conform,
    heldConform: heldMix.conform,
    layeredConform: layered.conform,
    layeredSampleTolerance,
    maxLayeredSampleError,
    peak: mix.peak,
    clippedSamples: mix.clippedSamples,
  };
}
