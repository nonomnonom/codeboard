import { splitStudioAudioClip } from "./clip-split.js";
import type { StudioAudioTrack, StudioAudioEdit } from "../model/types/studio-audio.js";
import { studioAudioEditsSchema } from "../model/schema/studio-audio.js";
import { defineStudioAudio } from "./studio.js";
import { CodeboardError, throwEditError } from "../model/errors.js";

/** Ordered metadata edits; sample fades/ranges are validated on the complete final state. */
export function reviseStudioAudio(
  tracks: readonly StudioAudioTrack[],
  edits: readonly StudioAudioEdit[],
): StudioAudioTrack[] {
  const parsed = studioAudioEditsSchema.safeParse(edits);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid studio audio edits", {
      details: { issues: parsed.error.issues },
    });
  const result = defineStudioAudio(tracks);
  const track = (id: string) => {
    const found = result.find((track) => track.id === id);
    if (!found) throw new CodeboardError("INVALID_ARGUMENT", `Studio audio track not found: ${id}`);
    return found;
  };
  const clip = (id: string) => {
    for (const track of result) {
      const index = track.clips.findIndex((clip) => clip.id === id);
      if (index >= 0) return { track, index, clip: track.clips[index]! };
    }
    throw new CodeboardError("INVALID_ARGUMENT", `Studio audio clip not found: ${id}`);
  };
  const unique = (ids: string[]) => {
    const known = new Set(
      result.flatMap((track) => [track.id, ...track.clips.map((clip) => clip.id)]),
    );
    for (const id of ids) {
      if (known.has(id))
        throw new CodeboardError("INVALID_ARGUMENT", `Duplicate studio audio ID: ${id}`);
      known.add(id);
    }
  };
  for (const [editIndex, edit] of parsed.data.entries()) {
    try {
      switch (edit.op) {
        case "track.add":
          unique([edit.track.id, ...edit.track.clips.map((clip) => clip.id)]);
          result.push(structuredClone(edit.track));
          break;
        case "track.update":
          Object.assign(track(edit.id), structuredClone(edit.changes));
          break;
        case "track.remove":
          result.splice(result.indexOf(track(edit.id)), 1);
          break;
        case "clip.add":
          unique([edit.clip.id]);
          track(edit.trackId).clips.push(structuredClone(edit.clip));
          break;
        case "clip.update":
          Object.assign(clip(edit.id).clip, structuredClone(edit.changes));
          break;
        case "clip.move": {
          const target = track(edit.trackId),
            found = clip(edit.id);
          if (target !== found.track) {
            found.track.clips.splice(found.index, 1);
            target.clips.push(found.clip);
          }
          if (edit.start !== undefined) found.clip.start = structuredClone(edit.start);
          break;
        }
        case "clip.split": {
          const found = clip(edit.id);
          unique([edit.newId]);
          const { left, right } = splitStudioAudioClip(found.clip, edit.atSample, edit.newId);
          found.track.clips.splice(found.index, 1, left, right);
          break;
        }
        case "clip.remove": {
          const found = clip(edit.id);
          found.track.clips.splice(found.index, 1);
          break;
        }
      }
    } catch (cause) {
      throwEditError(cause, "studio-audio", editIndex, edit.op);
    }
  }
  return defineStudioAudio(result);
}
