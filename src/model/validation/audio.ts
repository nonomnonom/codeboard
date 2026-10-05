import type { AudioClip } from "../types.js";

export function validateAudioFades(clip: AudioClip): void {
  if (clip.fadeInFrames + clip.fadeOutFrames > clip.durationFrames)
    throw new Error(`Audio fades overlap: ${clip.id}`);
}
