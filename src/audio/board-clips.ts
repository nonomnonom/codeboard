import type { AudioClip } from "../model/types.js";
import { audioClipSchema } from "../model/schema/audio.js";
import { validateAudioFades } from "../model/validation/audio.js";

/** Prepare frame-based board clip halves; the transaction owner assigns the new right ID. */
export function prepareBoardAudioSplit(clip: AudioClip, frame: number) {
  const end = clip.startFrame + clip.durationFrames;
  if (!Number.isSafeInteger(end))
    throw new Error("Audio clip end exceeds the safe integer frame range");
  if (frame <= clip.startFrame || frame >= end)
    throw new Error("Audio split frame must be strictly inside the clip");
  const leftDuration = frame - clip.startFrame,
    rightDuration = end - frame;
  if (leftDuration < clip.fadeInFrames || rightDuration < clip.fadeOutFrames)
    throw new Error(
      "Audio split crosses a fade; revise the fade or choose a frame between the fades",
    );
  const left = audioClipSchema.parse({
    ...clip,
    durationFrames: leftDuration,
    fadeOutFrames: 0,
  });
  const right = audioClipSchema.parse({
    ...clip,
    startFrame: frame,
    sourceInFrame: clip.sourceInFrame + leftDuration,
    durationFrames: rightDuration,
    fadeInFrames: 0,
  });
  validateAudioFades(left);
  validateAudioFades(right);
  return { left, right };
}
