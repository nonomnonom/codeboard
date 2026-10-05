import { z } from "zod";
import type { StudioAudioTrack } from "../model/types/studio-audio.js";
import { CodeboardError } from "../model/errors.js";

export interface AudioTrackRef {
  ownerId: string;
  trackId: string;
}
export const audioTrackSelectionSchema = z
  .array(
    z
      .object({ ownerId: z.string().min(1).max(4096), trackId: z.string().min(1).max(4096) })
      .strict(),
  )
  .max(4096);

/** Owners must already be isolated and validated by the conform operation. */
export function prepareTrackSelection(
  owners: readonly { id: string; audio?: StudioAudioTrack[] }[],
  input: readonly AudioTrackRef[] | undefined,
) {
  const parsed = input === undefined ? undefined : audioTrackSelectionSchema.safeParse(input);
  if (parsed && !parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid audio track selection", {
      details: { issues: parsed.error.issues },
    });
  const selection = parsed?.data;
  const selected = new Map<string, Set<string>>();
  if (selection !== undefined) {
    const known = new Map(owners.map((owner) => [owner.id, owner]));
    if (known.size !== owners.length)
      throw new CodeboardError("INVALID_ARGUMENT", "Audio selection owners must have unique IDs");
    for (const ref of selection) {
      if (!known.get(ref.ownerId)?.audio?.some((track) => track.id === ref.trackId))
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          `Audio track not found in selected timeline: ${ref.ownerId}/${ref.trackId}`,
        );
      const tracks = selected.get(ref.ownerId) ?? new Set<string>();
      if (tracks.has(ref.trackId))
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          `Duplicate audio track selection: ${ref.ownerId}/${ref.trackId}`,
        );
      tracks.add(ref.trackId);
      selected.set(ref.ownerId, tracks);
    }
  }
  return {
    selection,
    tracks: (owner: { id: string; audio?: StudioAudioTrack[] }) =>
      (owner.audio ?? []).filter(
        (track) => selection === undefined || selected.get(owner.id)?.has(track.id),
      ),
  };
}
