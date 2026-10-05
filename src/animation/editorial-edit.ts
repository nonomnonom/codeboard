import type { ShotAnimation } from "../model/types/shot.js";
import type { EditorialSequence, EditorialEdit } from "../model/types/editorial.js";
import { editorialEditsSchema } from "../model/schema/editorial.js";
import { defineEditorialSequence } from "./editorial.js";
import { CodeboardError, throwEditError } from "../model/errors.js";
import { rescaleTime } from "./rational-time.js";

/** Apply ordered edits to an isolated sequence, then ripple positions and validate its final state. */
export function reviseEditorialSequence(
  sequence: EditorialSequence,
  animations: readonly ShotAnimation[],
  edits: readonly EditorialEdit[],
): EditorialSequence {
  const parsed = editorialEditsSchema.safeParse(edits);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid editorial edits", {
      details: { issues: parsed.error.issues },
    });
  const result = defineEditorialSequence(sequence, animations);
  const indexOf = (id: string) => {
    const index = result.clips.findIndex((clip) => clip.id === id);
    if (index < 0) throw new CodeboardError("INVALID_ARGUMENT", `Editorial clip not found: ${id}`);
    return index;
  };
  for (const [editIndex, edit] of (parsed.data as EditorialEdit[]).entries()) {
    try {
      switch (edit.op) {
        case "split": {
          const index = indexOf(edit.id),
            clip = result.clips[index]!;
          if (edit.newId === result.id || result.clips.some((item) => item.id === edit.newId))
            throw new CodeboardError("INVALID_ARGUMENT", `Duplicate editorial ID: ${edit.newId}`);
          if (edit.atFrame >= clip.durationFrames)
            throw new CodeboardError(
              "INVALID_ARGUMENT",
              "Editorial split must be strictly inside the clip",
            );
          const source = animations.find((animation) => animation.id === clip.animationId);
          if (!source)
            throw new CodeboardError(
              "INVALID_ARGUMENT",
              `Missing shot animation: ${clip.animationId}`,
            );
          // An integral source boundary retains the floor-sampling phase on both pieces.
          const offset = rescaleTime(
            Math.max(0, edit.atFrame - (clip.holdFrames ?? 0)),
            result.frameRate,
            source.frameRate,
            "exact",
          ).value;
          const sourceInFrame = clip.sourceInFrame + offset;
          if (!Number.isSafeInteger(sourceInFrame))
            throw new CodeboardError(
              "RESOURCE_LIMIT",
              "Editorial split exceeds the safe source frame range",
            );
          const right = {
            ...structuredClone(clip),
            id: edit.newId,
            startFrame: 0,
            sourceInFrame,
            durationFrames: clip.durationFrames - edit.atFrame,
            ...(clip.holdFrames === undefined
              ? {}
              : { holdFrames: Math.max(0, clip.holdFrames - edit.atFrame) }),
          };
          if (clip.holdFrames !== undefined)
            clip.holdFrames = Math.min(clip.holdFrames, edit.atFrame);
          clip.durationFrames = edit.atFrame;
          clip.transition = { type: "cut", durationFrames: 0 };
          result.clips.splice(index + 1, 0, right);
          break;
        }
        case "insert": {
          if (edit.clip.id === result.id || result.clips.some((clip) => clip.id === edit.clip.id))
            throw new CodeboardError("INVALID_ARGUMENT", `Duplicate editorial ID: ${edit.clip.id}`);
          const index = edit.beforeId === undefined ? result.clips.length : indexOf(edit.beforeId);
          result.clips.splice(index, 0, { ...structuredClone(edit.clip), startFrame: 0 });
          break;
        }
        case "update": {
          const clip = result.clips[indexOf(edit.id)]!;
          Object.assign(clip, structuredClone(edit.changes));
          break;
        }
        case "move": {
          const index = indexOf(edit.id);
          if (edit.beforeId === edit.id) break;
          if (edit.beforeId !== undefined) indexOf(edit.beforeId);
          const [clip] = result.clips.splice(index, 1);
          const destination =
            edit.beforeId === undefined ? result.clips.length : indexOf(edit.beforeId);
          result.clips.splice(destination, 0, clip!);
          break;
        }
        case "remove":
          result.clips.splice(indexOf(edit.id), 1);
          break;
      }
    } catch (cause) {
      throwEditError(cause, "editorial", editIndex, edit.op);
    }
  }
  let cursor = 0;
  for (const clip of result.clips) {
    clip.startFrame = cursor;
    cursor += clip.durationFrames - clip.transition.durationFrames;
    if (!Number.isSafeInteger(cursor))
      throw new CodeboardError("RESOURCE_LIMIT", "Editorial timeline exceeds the safe frame range");
  }
  return defineEditorialSequence(result, animations);
}
