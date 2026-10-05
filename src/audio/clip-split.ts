import type { StudioAudioClip } from "../model/types/studio-audio.js";
import { addTime } from "../animation/rational-time.js";
import { CodeboardError } from "../model/errors.js";

/** Split validated studio metadata in source samples, retaining both outer fades. */
export function splitStudioAudioClip(clip: StudioAudioClip, atSample: number, newId: string) {
  const remaining = clip.source.sampleCount - atSample;
  if (!Number.isSafeInteger(atSample) || atSample <= 0 || remaining <= 0)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Audio split must be strictly inside the source trim",
      {
        details: { reason: "AUDIO_SPLIT_RANGE", clipId: clip.id, atSample },
      },
    );
  if (atSample < clip.fadeInSamples || remaining < clip.fadeOutSamples)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Audio split crosses a fade; revise the fade or choose another sample",
      {
        details: { reason: "AUDIO_SPLIT_FADE", clipId: clip.id, atSample },
      },
    );
  const start = addTime(clip.start.ticks, clip.start.rate, atSample, clip.source.sampleRate);
  const left: StudioAudioClip = {
    ...structuredClone(clip),
    source: { ...clip.source, sampleCount: atSample },
    fadeOutSamples: 0,
  };
  const right: StudioAudioClip = {
    ...structuredClone(clip),
    id: newId,
    start,
    source: {
      ...clip.source,
      startSample: clip.source.startSample + atSample,
      sampleCount: remaining,
    },
    fadeInSamples: 0,
  };
  return { left, right };
}
