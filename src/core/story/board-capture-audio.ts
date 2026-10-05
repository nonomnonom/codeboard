import type { StoryboardProject } from "../project.js";
import {
  createTimeMapper,
  type RationalRate,
  type TimeRounding,
} from "../../animation/rational-time.js";
import { defineStudioAudio } from "../../audio/studio.js";
import type { StudioAudioTrack } from "../../model/types/studio-audio.js";
import { CodeboardError } from "../../model/errors.js";

/** Convert board clocks without opening media; supplied rates must describe decoded source samples. */
export function captureBoardAudio(
  project: StoryboardProject,
  sequenceId: string,
  frameRate: RationalRate,
  settings: { sampleRates: Record<string, number>; rounding: TimeRounding },
  reserve: (id: string) => void,
) {
  const tracks: StudioAudioTrack[] = [];
  const mappings: { sourceId: string; targetId: string }[] = [];
  let clips = 0,
    quantizedPositions = 0;
  const newId = (kind: string, sourceId: string) => {
    const id = `${sequenceId}:${kind}:${sourceId}`;
    reserve(id);
    mappings.push({ sourceId, targetId: id });
    return id;
  };
  for (let offset = 0; ; offset += 50) {
    const page = project.production.audioTracks({ offset, limit: 50 });
    for (const track of page) {
      if (tracks.length >= 1000 || clips + track.clipCount > 1000)
        throw new CodeboardError(
          "RESOURCE_LIMIT",
          "Board capture supports at most 1000 audio tracks and clips",
        );
      const copied: StudioAudioTrack = {
        id: newId("audio-track", track.id),
        name: track.name,
        muted: track.muted,
        clips: [],
      };
      for (let clipOffset = 0; clipOffset < track.clipCount; clipOffset++) {
        const clip = project.production.audioClips(track.id, { offset: clipOffset, limit: 1 })[0]!;
        if (!Object.hasOwn(settings.sampleRates, clip.assetId))
          throw new CodeboardError(
            "INVALID_ARGUMENT",
            "Board capture requires a source sample rate for every audio asset",
            {
              details: { assetId: clip.assetId, clipId: clip.id },
            },
          );
        const sampleRate = settings.sampleRates[clip.assetId]!;
        const convert = createTimeMapper(frameRate, sampleRate, settings.rounding);
        const sample = (value: number, field: string) => {
          try {
            const result = convert(value);
            if (!result.exact) quantizedPositions++;
            return result.value;
          } catch (cause) {
            if (cause instanceof CodeboardError)
              throw new CodeboardError(cause.code, cause.message, {
                details: { ...cause.details, clipId: clip.id, field },
                cause,
              });
            throw cause;
          }
        };
        const startSample = sample(clip.sourceInFrame, "sourceInFrame");
        const endSample = sample(clip.sourceInFrame + clip.durationFrames, "sourceEndFrame");
        copied.clips.push({
          id: newId("audio-clip", clip.id),
          name: clip.name,
          assetId: clip.assetId,
          start: { ticks: clip.startFrame, rate: { ...frameRate } },
          source: { sampleRate, startSample, sampleCount: endSample - startSample },
          volume: clip.volume,
          fadeInSamples: sample(clip.fadeInFrames, "fadeInFrames"),
          fadeOutSamples: sample(clip.fadeOutFrames, "fadeOutFrames"),
        });
        clips++;
      }
      tracks.push(copied);
    }
    if (page.length < 50) break;
  }
  return { tracks: defineStudioAudio(tracks), mappings, quantizedPositions };
}
