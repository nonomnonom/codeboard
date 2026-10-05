import type { AudioSampleRounding } from "../audio/sample-clock.js";
import { mixShotAudio, mixEditorialAudio, type StudioAudioDecoder } from "../audio/mix.js";
import type { ShotAnimation } from "../model/types/shot.js";
import type { EditorialSequence } from "../model/types/editorial.js";
import { defineShotAnimation } from "../animation/shot.js";
import { prepareEditorial } from "../animation/editorial.js";
import type { RationalRate } from "../animation/rational-time.js";
import { CodeboardError } from "../model/errors.js";
import { assertMovieFrames, type MovieEncodingOptions } from "./movie-encoder.js";
import { resolveFrameRange } from "./limits.js";
import { rescaleTime } from "../animation/rational-time.js";
import { checkShotFonts, type FontPolicy } from "../render/fonts.js";

export interface StudioMovieOptions extends MovieEncodingOptions {
  fontPolicy?: FontPolicy;
  range?: { startFrame: number; endFrame: number };
  audio?:
    | "omit"
    | {
        mode: "mix";
        decoder: StudioAudioDecoder;
        transitions: "sum" | "linear";
        maxSamples?: number;
        rounding?: AudioSampleRounding;
      };
}

function movieRange(
  session: { durationFrames: number; frameRate: RationalRate },
  options: StudioMovieOptions,
) {
  const range = resolveFrameRange(session.durationFrames, options.range);
  const durationFrames = range.endFrame - range.startFrame;
  assertMovieFrames(durationFrames, options.maxFrames);
  return {
    range,
    durationFrames,
    frameRate: { ...session.frameRate },
  };
}

function movieAudioRange(
  session: ReturnType<typeof movieRange>,
  rounding: AudioSampleRounding = "nearest",
) {
  return {
    startSample: rescaleTime(session.range.startFrame, session.frameRate, 48000, rounding).value,
    endSample: rescaleTime(session.range.endFrame, session.frameRate, 48000, rounding).value,
  };
}

function audioPolicy(
  owners: readonly { audio?: import("../model/types/studio-audio.js").StudioAudioTrack[] }[],
  options: StudioMovieOptions,
) {
  const policy = options.audio;
  if (policy !== undefined && policy !== "omit") {
    if (
      !policy ||
      typeof policy !== "object" ||
      policy.mode !== "mix" ||
      typeof policy.decoder !== "function" ||
      !["sum", "linear"].includes(policy.transitions) ||
      (policy.rounding !== undefined && !["nearest", "exact"].includes(policy.rounding))
    )
      throw new CodeboardError("INVALID_ARGUMENT", "Invalid studio movie audio policy");
    return { ...policy };
  }
  if (
    policy !== "omit" &&
    owners.some((owner) => owner.audio?.some((track) => !track.muted && track.clips.length))
  )
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Choose an audio mix policy or explicit omission for studio audio",
    );
  return undefined;
}

function dimensions(
  canvases: readonly { width: number; height: number }[],
  outputCanvas?: { width: number; height: number },
): void {
  const first = canvases[0];
  if (
    !first ||
    canvases.some((canvas) => canvas.width !== first.width || canvas.height !== first.height)
  )
    throw new CodeboardError("INVALID_ARGUMENT", "Movie sources must share dimensions");
  const output = outputCanvas ?? first;
  if (output.width % 2 || output.height % 2)
    throw new CodeboardError("INVALID_ARGUMENT", "H.264 export requires even frame dimensions");
}

/** Prepare picture timing and audio once for direct rendering or stored-frame delivery. */
export async function prepareShotMovie(
  animation: ShotAnimation,
  options: StudioMovieOptions = {},
  outputCanvas?: { width: number; height: number },
) {
  const settings = { ...options },
    source = defineShotAnimation(animation);
  const selected = movieRange(source, settings);
  const policy = audioPolicy([source], settings);
  dimensions([source.canvas], outputCanvas);
  checkShotFonts([source], settings.fontPolicy);
  const mix = policy
    ? await mixShotAudio(source, policy.decoder, {
        sampleRate: 48000,
        range: movieAudioRange(selected, policy.rounding),
        ...(policy.rounding === undefined ? {} : { rounding: policy.rounding }),
        ...(policy.maxSamples === undefined ? {} : { maxSamples: policy.maxSamples }),
        ...(settings.signal ? { signal: settings.signal } : {}),
      })
    : undefined;
  return { selected, settings, mix, source };
}

export async function prepareEditorialMovie(
  sequence: EditorialSequence,
  animations: readonly ShotAnimation[],
  options: StudioMovieOptions = {},
  outputCanvas?: { width: number; height: number },
) {
  const settings = { ...options },
    source = prepareEditorial(sequence, animations);
  const selected = movieRange(
    { durationFrames: source.durationFrames, frameRate: source.sequence.frameRate },
    settings,
  );
  const ids = new Set(source.sequence.clips.map((clip) => clip.animationId));
  const library = [...source.sources.values()];
  const sources = library.filter((animation) => ids.has(animation.id));
  const policy = audioPolicy([source.sequence, ...sources], settings);
  dimensions(
    sources.map((animation) => animation.canvas),
    outputCanvas,
  );
  checkShotFonts(sources, settings.fontPolicy);
  const mix = policy
    ? await mixEditorialAudio(source.sequence, library, policy.decoder, {
        sampleRate: 48000,
        range: movieAudioRange(selected, policy.rounding),
        ...(policy.rounding === undefined ? {} : { rounding: policy.rounding }),
        transitions: policy.transitions,
        ...(policy.maxSamples === undefined ? {} : { maxSamples: policy.maxSamples }),
        ...(settings.signal ? { signal: settings.signal } : {}),
      })
    : undefined;
  return { selected, settings, mix, sequence: source.sequence, animations: library };
}
