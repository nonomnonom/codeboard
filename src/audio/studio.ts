import { audioSampleClock, type AudioSampleRounding } from "./sample-clock.js";
import { studioAudioSchema } from "../model/schema/studio-audio.js";
import type { StudioAudioTrack, StudioAudioClip } from "../model/types/studio-audio.js";
import type { TimeConversion } from "../animation/rational-time.js";
import { CodeboardError } from "../model/errors.js";

export interface CompiledAudioClip {
  trackId: string;
  clip: StudioAudioClip;
  startSample: TimeConversion;
  sampleCount: TimeConversion;
  fadeInSamples: TimeConversion;
  fadeOutSamples: TimeConversion;
}

export function defineStudioAudio(input: unknown): StudioAudioTrack[] {
  const result = studioAudioSchema.safeParse(input);
  if (!result.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid studio audio", {
      details: { issues: result.error.issues },
    });
  return result.data;
}

/** Resolve audible placements to a chosen sample clock without resampling or reading media. */
export function compileStudioAudio(
  tracks: readonly StudioAudioTrack[],
  sampleRate: number,
  options: { rounding?: AudioSampleRounding } = {},
): CompiledAudioClip[] {
  const sample = audioSampleClock(sampleRate, options.rounding);
  return defineStudioAudio(tracks)
    .filter((track) => !track.muted)
    .flatMap((track) =>
      track.clips.map((clip) => {
        const sourceRate = clip.source.sampleRate;
        const startSample = sample(clip.start.ticks, clip.start.rate);
        const sampleCount = sample(clip.source.sampleCount, sourceRate);
        const fadeInSamples = sample(clip.fadeInSamples, sourceRate);
        const fadeOutSamples = sample(clip.fadeOutSamples, sourceRate);
        if (sampleCount.value < 1)
          throw new CodeboardError(
            "INVALID_ARGUMENT",
            `Audio clip collapses at the output sample rate: ${clip.id}`,
          );
        if (!Number.isSafeInteger(startSample.value + sampleCount.value))
          throw new CodeboardError(
            "RESOURCE_LIMIT",
            "Audio placement exceeds the safe sample range",
          );
        if (fadeInSamples.value > sampleCount.value - fadeOutSamples.value)
          throw new CodeboardError(
            "INVALID_ARGUMENT",
            `Audio fades overlap after sample conversion: ${clip.id}`,
          );
        return { trackId: track.id, clip, startSample, sampleCount, fadeInSamples, fadeOutSamples };
      }),
    );
}
