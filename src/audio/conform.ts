import { audioSampleClock, type AudioSampleRounding } from "./sample-clock.js";
import type { ShotAnimation } from "../model/types/shot.js";
import type { EditorialSequence } from "../model/types/editorial.js";
import { defineShotAnimation } from "../animation/shot.js";
import { prepareEditorial } from "../animation/editorial.js";
import { compileStudioAudio, type CompiledAudioClip } from "./studio.js";
import type { TimeConversion } from "../animation/rational-time.js";
import { CodeboardError } from "../model/errors.js";
import { prepareTrackSelection, type AudioTrackRef } from "./selection.js";

export interface AudioGainRamp {
  startSample: number;
  endSample: number;
  from: number;
  to: number;
}
export interface ConformedAudioSegment {
  ownerId: string;
  editorialClipId?: string;
  audio: CompiledAudioClip;
  outputStartSample: number;
  clipOffsetSamples: number;
  sampleCount: number;
  ramps: AudioGainRamp[];
}
export interface AudioConform {
  rounding?: AudioSampleRounding;
  trackSelection?: AudioTrackRef[];
  sampleRate: number;
  duration: TimeConversion;
  segments: ConformedAudioSegment[];
  windows: {
    clipId: string;
    sourceStart: TimeConversion;
    outputStart: TimeConversion;
    outputEnd: TimeConversion;
    /** Present when source playback begins after an initial silent picture hold. */
    playbackStart?: TimeConversion;
    sourceLimit: TimeConversion;
  }[];
  transitions: "sum" | "linear";
}

function append(
  segments: ConformedAudioSegment[],
  ownerId: string,
  audio: CompiledAudioClip[],
  windowStart: number,
  windowCount: number,
  outputStart: number,
  ramps: AudioGainRamp[],
  editorialClipId?: string,
): void {
  const windowEnd = windowStart + windowCount;
  if (!Number.isSafeInteger(windowEnd))
    throw new CodeboardError(
      "RESOURCE_LIMIT",
      "Audio conform window exceeds the safe sample range",
    );
  for (const clip of audio) {
    const start = Math.max(windowStart, clip.startSample.value),
      end = Math.min(windowEnd, clip.startSample.value + clip.sampleCount.value);
    if (end <= start) continue;
    const output = outputStart + (start - windowStart);
    if (!Number.isSafeInteger(output + (end - start)))
      throw new CodeboardError(
        "RESOURCE_LIMIT",
        "Audio conform placement exceeds the safe sample range",
      );
    segments.push({
      ownerId,
      ...(editorialClipId === undefined ? {} : { editorialClipId }),
      audio: clip,
      outputStartSample: output,
      clipOffsetSamples: start - clip.startSample.value,
      sampleCount: end - start,
      ramps: structuredClone(ramps),
    });
  }
}

export function conformShotAudio(
  animation: ShotAnimation,
  sampleRate = 48000,
  options: { tracks?: readonly AudioTrackRef[]; rounding?: AudioSampleRounding } = {},
): AudioConform {
  const rounding = options.rounding === undefined ? "nearest" : options.rounding,
    sample = audioSampleClock(sampleRate, rounding);
  const source = defineShotAnimation(animation),
    duration = sample(source.durationFrames, source.frameRate);
  const selected = prepareTrackSelection([source], options.tracks);
  if (duration.value < 1)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Shot duration collapses at the output sample rate",
    );
  const segments: ConformedAudioSegment[] = [];
  append(
    segments,
    source.id,
    compileStudioAudio(selected.tracks(source), sampleRate, { rounding }),
    0,
    duration.value,
    0,
    [],
  );
  return {
    sampleRate,
    rounding,
    duration,
    segments,
    windows: [],
    transitions: "sum",
    ...(selected.selection === undefined ? {} : { trackSelection: selected.selection }),
  };
}

/** Conform at normal playback speed; source audio is cropped, never frame-duplicated or time-stretched. */
export function conformEditorialAudio(
  sequence: EditorialSequence,
  animations: readonly ShotAnimation[],
  options: {
    sampleRate: number;
    transitions: "sum" | "linear";
    tracks?: readonly AudioTrackRef[];
    rounding?: AudioSampleRounding;
  },
): AudioConform {
  const rounding = options.rounding === undefined ? "nearest" : options.rounding,
    sample = audioSampleClock(options.sampleRate, rounding);
  if (options.transitions !== "sum" && options.transitions !== "linear")
    throw new CodeboardError("INVALID_ARGUMENT", "Choose sum or linear audio transitions");
  const prepared = prepareEditorial(sequence, animations),
    rate = options.sampleRate;
  const used = new Set(prepared.sequence.clips.map((clip) => clip.animationId));
  const sources = [...prepared.sources.values()].filter((source) => used.has(source.id));
  const selected = prepareTrackSelection([prepared.sequence, ...sources], options.tracks);
  const duration = sample(prepared.durationFrames, prepared.sequence.frameRate);
  if (duration.value < 1)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Editorial duration collapses at the output sample rate",
    );
  const result: AudioConform = {
    ...(selected.selection === undefined ? {} : { trackSelection: selected.selection }),
    sampleRate: rate,
    rounding,
    duration,
    segments: [],
    windows: [],
    transitions: options.transitions,
  };
  const compiled = new Map(
    sources.map((animation) => [
      animation.id,
      compileStudioAudio(selected.tracks(animation), rate, { rounding }),
    ]),
  );
  const position = (frame: number) => sample(frame, prepared.sequence.frameRate);
  for (const [index, clip] of prepared.sequence.clips.entries()) {
    const source = prepared.sources.get(clip.animationId)!;
    const sourceStart = sample(clip.sourceInFrame, source.frameRate);
    const outputStart = position(clip.startFrame),
      outputEnd = position(clip.startFrame + clip.durationFrames);
    const sourceLimit = sample(source.durationFrames, source.frameRate);
    const playbackStart = position(clip.startFrame + (clip.holdFrames ?? 0));
    result.windows.push({
      clipId: clip.id,
      sourceStart,
      outputStart,
      outputEnd,
      sourceLimit,
      ...(clip.holdFrames ? { playbackStart } : {}),
    });
    const count = outputEnd.value - outputStart.value;
    if (count < 1)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        `Editorial clip collapses at the audio output rate: ${clip.id}`,
      );
    const ramps: AudioGainRamp[] = [];
    if (options.transitions === "linear") {
      const previous = prepared.sequence.clips[index - 1];
      if (previous?.transition.durationFrames) {
        const end = position(previous.startFrame + previous.durationFrames).value;
        if (end <= outputStart.value)
          throw new CodeboardError(
            "INVALID_ARGUMENT",
            "Audio transition collapses at the output sample rate",
          );
        ramps.push({ startSample: outputStart.value, endSample: end, from: 0, to: 1 });
      }
      if (clip.transition.durationFrames) {
        const start = position(
          clip.startFrame + clip.durationFrames - clip.transition.durationFrames,
        ).value;
        if (start >= outputEnd.value)
          throw new CodeboardError(
            "INVALID_ARGUMENT",
            "Audio transition collapses at the output sample rate",
          );
        ramps.push({ startSample: start, endSample: outputEnd.value, from: 1, to: 0 });
      }
    }
    const sourceEnd = sourceLimit.value;
    append(
      result.segments,
      source.id,
      compiled.get(source.id)!,
      sourceStart.value,
      Math.max(0, Math.min(outputEnd.value - playbackStart.value, sourceEnd - sourceStart.value)),
      playbackStart.value,
      ramps,
      clip.id,
    );
  }
  append(
    result.segments,
    prepared.sequence.id,
    compileStudioAudio(selected.tracks(prepared.sequence), rate, { rounding }),
    0,
    duration.value,
    0,
    [],
  );
  return result;
}
